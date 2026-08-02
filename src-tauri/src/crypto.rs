//! Password hashing (Argon2id) and optional backup encryption key management.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Argon2, Params, Version};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Nonce};
use rand_core::{OsRng, RngCore};

pub const MASTER_HASH_KEY: &str = "master_password_hash";
pub const MASTER_SALT_KEY: &str = "master_password_salt";
pub const PASSWORD_ALGO_KEY: &str = "master_password_algo";
pub const ALGO_ARGON2: &str = "argon2id";
pub const ALGO_SHA256_LEGACY: &str = "sha256";

const KEYRING_SERVICE: &str = "com.kwiken.desktop";
const KEYRING_USER: &str = "backup-encryption-key";

fn argon2() -> Argon2<'static> {
    let params = Params::new(19 * 1024, 2, 1, None).expect("valid argon2 params");
    Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params)
}

/// Hash a password with Argon2id; returns a PHC string (includes salt).
pub fn hash_password_argon2(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    argon2()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Password hash failed: {e}"))
}

pub fn verify_password_argon2(password: &str, phc: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(phc).map_err(|e| format!("Invalid password hash: {e}"))?;
    Ok(argon2()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// Legacy SHA-256(salt || password) hex digest used before Argon2 migration.
pub fn hash_password_sha256_legacy(password: &str, salt: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn generate_db_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    key
}

pub fn store_db_key(key: &[u8; 32]) -> Result<(), String> {
    let encoded = hex::encode(key);
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Keyring unavailable: {e}"))?;
    entry
        .set_password(&encoded)
        .map_err(|e| format!("Could not store encryption key: {e}"))
}

pub fn load_db_key() -> Result<Option<[u8; 32]>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Keyring unavailable: {e}"))?;
    match entry.get_password() {
        Ok(encoded) => {
            let bytes =
                hex::decode(encoded.trim()).map_err(|e| format!("Corrupt encryption key: {e}"))?;
            if bytes.len() != 32 {
                return Err("Corrupt encryption key length".into());
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&bytes);
            Ok(Some(key))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not load encryption key: {e}")),
    }
}

pub fn delete_db_key() -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Keyring unavailable: {e}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Could not delete encryption key: {e}")),
    }
}

/// Encrypt plaintext bytes with ChaCha20-Poly1305. Output = nonce || ciphertext.
pub fn seal_bytes(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {e}"))?;
    let mut out = Vec::with_capacity(12 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn open_bytes(key: &[u8; 32], sealed: &[u8]) -> Result<Vec<u8>, String> {
    if sealed.len() < 13 {
        return Err("Encrypted payload too short".into());
    }
    let (nonce_bytes, ciphertext) = sealed.split_at(12);
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong key or corrupt file".into())
}

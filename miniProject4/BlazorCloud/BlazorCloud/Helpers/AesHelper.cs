using System.Security.Cryptography;
using System.Text;

namespace BlazorCloud.Helpers;

public static class AesHelper
{
        // 32‑byte (256‑bit) key, 16‑byte (128‑bit) IV – change as required
        private static readonly byte[] _key = Convert.FromBase64String("1234567890abcdef");
        private static readonly byte[] _iv  = Convert.FromBase64String("abcdef1234567890");

        public static string Decrypt(byte[] cipherBytes)
        {
            using var aes = Aes.Create();
            aes.Key = _key;
            aes.IV  = _iv;
            aes.Padding = PaddingMode.PKCS7; // TODO: Verify this is the correct padding mode
            aes.Mode = CipherMode.CBC;

            using var decryptor = aes.CreateDecryptor();
            using var ms = new MemoryStream(cipherBytes);
            using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using var sr = new StreamReader(cs, Encoding.UTF8);
            return sr.ReadToEnd();
        }
}


/// <summary>
/// Mirrors the C++ AES‑128‑CBC + zero‑pad + Base64 routine.
/// </summary>
public static class AesCbcHelper
{
    // 16‑byte key:  "1234567890abcdef"
    private static readonly byte[] AES_KEY =
        Encoding.ASCII.GetBytes("1234567890abcdef");

    // 16‑byte IV : "abcdef1234567890"
    private static readonly byte[] AES_IV =
        Encoding.ASCII.GetBytes("abcdef1234567890");

    /// <summary>
    /// Encrypts a plain‑text string using AES‑128‑CBC with zero‑padding.
    /// Returns the ciphertext as a Base‑64 string.
    /// </summary>
    public static string EncryptData(string plainText)
    {
        if (plainText == null) throw new ArgumentNullException(nameof(plainText));

        // 1. Convert to bytes (UTF‑8 keeps the semantics of the C++ string)
        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);

        // 2. Pad to a multiple of 16 bytes (zero‑padding)
        int paddedLen = ((plainBytes.Length + 15) / 16) * 16;
        byte[] paddedInput = new byte[paddedLen];
        Array.Copy(plainBytes, paddedInput, plainBytes.Length); // rest remains 0

        // 3. Encrypt
        using (Aes aes = Aes.Create())
        {
            aes.KeySize   = 128;                // 128‑bit key
            aes.BlockSize = 128;                // 128‑bit block (default)
            aes.Mode      = CipherMode.CBC;     // CBC mode
            aes.Padding   = PaddingMode.None;   // we padded ourselves
            aes.Key       = AES_KEY;
            aes.IV        = AES_IV;

            using (ICryptoTransform encryptor = aes.CreateEncryptor())
            {
                byte[] cipherBytes = encryptor.TransformFinalBlock(
                    paddedInput, 0, paddedInput.Length);

                // 4. Base‑64 encode
                return Convert.ToBase64String(cipherBytes);
            }
        }
    }

    /// <summary>
    /// Decrypts a Base‑64 encoded string that was produced by <c>EncryptData</c>.
    /// Returns the original plain‑text string, stripping any zero‑padding.
    /// </summary>
    public static string DecryptData(string base64CipherText)
    {
        if (base64CipherText == null) throw new ArgumentNullException(nameof(base64CipherText));

        // 1. Decode Base‑64
        byte[] cipherBytes = Convert.FromBase64String(base64CipherText);

        // 2. Decrypt
        using (Aes aes = Aes.Create())
        {
            aes.KeySize   = 128;
            aes.BlockSize = 128;
            aes.Mode      = CipherMode.CBC;
            aes.Padding   = PaddingMode.None;   // no PKCS#7 padding to remove
            aes.Key       = AES_KEY;
            aes.IV        = AES_IV;

            using (ICryptoTransform decryptor = aes.CreateDecryptor())
            {
                byte[] paddedPlain = decryptor.TransformFinalBlock(
                    cipherBytes, 0, cipherBytes.Length);

                // 3. Trim trailing zero bytes (the manual padding added during encryption)
                int trimLen = paddedPlain.Length;
                while (trimLen > 0 && paddedPlain[trimLen - 1] == 0)
                {
                    trimLen--;
                }

                // 4. Convert back to string (UTF‑8)
                return Encoding.UTF8.GetString(paddedPlain, 0, trimLen);
            }
        }
    }
}


public class AesDecryptor
{
    private static readonly byte[] AES_KEY = Encoding.UTF8.GetBytes("1234567890abcdef");
    private static readonly byte[] AES_IV = Encoding.UTF8.GetBytes("abcdef1234567890");

    public static string DecryptAes(string encryptedBase64)
    {
        // Decode the base64 encrypted string
        byte[] encryptedBytes = Convert.FromBase64String(encryptedBase64);

        // Create AES decryptor
        using (Aes aesAlg = Aes.Create())
        {
            aesAlg.Key = AES_KEY;
            aesAlg.IV = AES_IV;
            aesAlg.Mode = CipherMode.CBC;
            aesAlg.Padding = PaddingMode.Zeros;

            // Create a decryptor to perform the stream transform
            using (ICryptoTransform decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV))
            {
                using (MemoryStream msDecrypt = new MemoryStream(encryptedBytes))
                {
                    using (CryptoStream csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read))
                    {
                        using (StreamReader srDecrypt = new StreamReader(csDecrypt))
                        {
                            // Read the decrypted bytes
                            string decrypted = srDecrypt.ReadToEnd();
                            return decrypted.TrimEnd('\0');
                        }
                    }
                }
            }
        }
    }
}
using System.Security.Cryptography;
using System.Text;

namespace BlazorCloud.Helpers;

public static class AesEncryptionHelper
{
    // These keys are hardcoded for demonstration.
    // Ideally for communication standard httpS security mechanisms would be used for communication,
    // and for database encryption a Key Store would be used to store the real keys.
    private static readonly byte[] AES_KEY = Encoding.UTF8.GetBytes("1234567890abcdef");
    private static readonly byte[] AES_IV = Encoding.UTF8.GetBytes("abcdef1234567890");

    public static string DecryptStringFromBase64(string encryptedBase64)
    {
        // Decode the base64 encrypted string
        byte[] encryptedBytes = Convert.FromBase64String(encryptedBase64);

        return DecryptString(encryptedBytes);
    }

    public static string DecryptString(in byte[] encryptedBytes)
    {
        // Create AES decryptor
        using Aes aesAlg = Aes.Create();
        aesAlg.Key = AES_KEY;
        aesAlg.IV = AES_IV;
        aesAlg.Mode = CipherMode.CBC;
        aesAlg.Padding = PaddingMode.Zeros;

        // Create a decryptor to perform the stream transform
        using ICryptoTransform decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);
        using MemoryStream msDecrypt = new MemoryStream(encryptedBytes);
        using CryptoStream csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read);
        using StreamReader srDecrypt = new StreamReader(csDecrypt);
        
        // Read the decrypted bytes
        string decrypted = srDecrypt.ReadToEnd();
        return decrypted.TrimEnd('\0');
    }
    
    /// <summary>
        /// Encrypts a single‑precision float value into a byte array that can be stored
        /// as binary data in a database. The same key/IV as the rest of the helpers
        /// are used, so the value can be decrypted with <see cref="DecryptFloat"/>.
        /// </summary>
        public static byte[] EncryptFloat(float value)
        {
            // 1. Convert the float to a 4‑byte array (little‑endian).
            byte[] plainBytes = BitConverter.GetBytes(value);

            using Aes aesAlg = Aes.Create();
            aesAlg.Key = AES_KEY;
            aesAlg.IV  = AES_IV;
            aesAlg.Mode = CipherMode.CBC;
            aesAlg.Padding = PaddingMode.Zeros; // 4 bytes → 16‑byte block

            // 2. Encrypt the byte array.
            using ICryptoTransform encryptor = aesAlg.CreateEncryptor(aesAlg.Key, aesAlg.IV);
            using MemoryStream msEncrypt = new MemoryStream();
            using CryptoStream csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write);
            csEncrypt.Write(plainBytes, 0, plainBytes.Length);
            csEncrypt.FlushFinalBlock();

            return msEncrypt.ToArray();
        }

        /// <summary>
        /// Decrypts the byte array produced by <see cref="EncryptFloat"/> back into the
        /// original float value.
        /// </summary>
        public static float DecryptFloat(byte[] encryptedBytes)
        {
            using Aes aesAlg = Aes.Create();
            aesAlg.Key = AES_KEY;
            aesAlg.IV  = AES_IV;
            aesAlg.Mode = CipherMode.CBC;
            aesAlg.Padding = PaddingMode.Zeros;

            using ICryptoTransform decryptor = aesAlg.CreateDecryptor(aesAlg.Key, aesAlg.IV);
            using MemoryStream msDecrypt = new MemoryStream(encryptedBytes);
            using CryptoStream csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read);

            byte[] plainBytes = new byte[4];
            int bytesRead = csDecrypt.Read(plainBytes, 0, plainBytes.Length);
            if (bytesRead != 4)
                throw new InvalidOperationException("Decrypted data is not a valid 4‑byte float.");

            return BitConverter.ToSingle(plainBytes, 0);
        }
        
        /// <summary>
        /// Encrypts a plain text string into a binary blob that can be stored in the DB.
        /// The returned byte[] can be fed straight into an EF Core value converter.
        /// </summary>
        public static byte[] EncryptString(string plainText)
        {
            if (plainText == null) throw new ArgumentNullException(nameof(plainText));

            byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);

            using Aes aesAlg = Aes.Create();
            aesAlg.Key = AES_KEY;
            aesAlg.IV  = AES_IV;
            aesAlg.Mode = CipherMode.CBC;
            aesAlg.Padding = PaddingMode.Zeros;

            using ICryptoTransform encryptor = aesAlg.CreateEncryptor(aesAlg.Key, aesAlg.IV);
            using MemoryStream msEncrypt = new MemoryStream();
            using CryptoStream csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write);
            csEncrypt.Write(plainBytes, 0, plainBytes.Length);
            csEncrypt.FlushFinalBlock();

            return msEncrypt.ToArray();
        }

        /// <summary>
        /// Decrypts a byte array produced by <see cref="EncryptString"/> back into the original string.
        /// </summary>
        public static string DecryptStringFromBytes(byte[] encryptedBytes)
        {
            if (encryptedBytes == null) throw new ArgumentNullException(nameof(encryptedBytes));
            return DecryptString(encryptedBytes);
        }

        /// <summary>
        /// Convenience overload that encrypts a string and returns a Base64 string.
        /// Useful if you want to store the encrypted data as a Base64 column instead of binary.
        /// </summary>
        public static string EncryptStringToBase64(string plainText)
        {
            return Convert.ToBase64String(EncryptString(plainText));
        }

        /// <summary>
        /// Convenience overload that decrypts a Base64 string that was produced by
        /// <see cref="EncryptStringToBase64"/>.
        /// </summary>
        public static string DecryptBase64String(string base64)
        {
            byte[] encryptedBytes = Convert.FromBase64String(base64);
            return DecryptString(encryptedBytes);
        }
}
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
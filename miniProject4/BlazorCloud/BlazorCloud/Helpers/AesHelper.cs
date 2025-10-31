using System.Security.Cryptography;
using System.Text;

namespace BlazorCloud.Helpers;

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
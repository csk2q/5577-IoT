using BlazorCloud.Helpers;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace BlazorCloud.Data;

public class EncryptedFloatConverter : ValueConverter<float, byte[]>
{
    public EncryptedFloatConverter() : base(
        v => AesEncryptionHelper.EncryptFloat(v),
        v => AesEncryptionHelper.DecryptFloat(v))
    { }
}

public class EncryptedStringConverter :  ValueConverter<string, byte[]>
{
    public EncryptedStringConverter()
        : base(
            v => AesEncryptionHelper.EncryptString(v),            // model → provider
            v => AesEncryptionHelper.DecryptString(v))           // provider → model
    {
    }
}
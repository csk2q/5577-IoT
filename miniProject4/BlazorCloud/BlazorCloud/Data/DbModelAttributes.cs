namespace BlazorCloud.Data;

[AttributeUsage(AttributeTargets.Property)]
public sealed class EncryptedFloatAttribute : Attribute { }

[AttributeUsage(AttributeTargets.Property)]
public sealed class EncryptedStringAttribute : Attribute { }

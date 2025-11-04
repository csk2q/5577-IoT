using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlazorCloud.Migrations
{
    /// <inheritdoc />
    public partial class AddEncryptionToTempAndHumidity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte[]>(
                name: "Temperature",
                table: "EnvironmentData",
                type: "BLOB",
                nullable: false,
                oldClrType: typeof(float),
                oldType: "REAL");

            migrationBuilder.AlterColumn<byte[]>(
                name: "Humidity",
                table: "EnvironmentData",
                type: "BLOB",
                nullable: false,
                oldClrType: typeof(float),
                oldType: "REAL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<float>(
                name: "Temperature",
                table: "EnvironmentData",
                type: "REAL",
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "BLOB");

            migrationBuilder.AlterColumn<float>(
                name: "Humidity",
                table: "EnvironmentData",
                type: "REAL",
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "BLOB");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlazorCloud.Migrations
{
    /// <inheritdoc />
    public partial class TimestampIsUlong : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            //    Convert the existing datetime strings to epoch‑ms.
            //    strftime('%s', ...) returns seconds, we multiply by 1000.
            //    The cast guarantees we store a proper INTEGER value.
            migrationBuilder.Sql(@"
            UPDATE EnvironmentData
            SET Timestamp = CAST(strftime('%s', Timestamp) * 1000 AS INTEGER);
            ");
            
            migrationBuilder.AlterColumn<ulong>(
                name: "Timestamp",
                table: "EnvironmentData",
                type: "INTEGER",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "TEXT");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            //    Convert the milliseconds back to an ISO‑8601 string.
            //    SQLite’s datetime() will give us a string in the default format
            //    (YYYY-MM-DD HH:MM:SS). If you need a different format, adjust
            //    the format string accordingly.
            migrationBuilder.Sql(@"
            UPDATE EnvironmentData
            SET Timestamp = datetime(Timestamp / 1000, 'unixepoch');
            ");
            
            migrationBuilder.AlterColumn<DateTime>(
                name: "Timestamp",
                table: "EnvironmentData",
                type: "TEXT",
                nullable: false,
                oldClrType: typeof(ulong),
                oldType: "INTEGER");
        }
        
    }
}

using EventLy.Api.Data;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Shouldly;

namespace EventLy.UnitTests.Data;

public sealed class ConnectionStringTests
{
    private static IConfiguration ConfigWith(string? connectionString) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Database"] = connectionString })
            .Build();

    [Fact]
    public void Disables_gss_encryption_by_default()
    {
        var result = PersistenceSetup.GetConnectionString(ConfigWith("Host=db;Database=evently;Username=u;Password=p"));

        new NpgsqlConnectionStringBuilder(result).GssEncryptionMode.ShouldBe(GssEncryptionMode.Disable);
    }

    [Fact]
    public void Keeps_an_explicit_gss_encryption_mode()
    {
        var result = PersistenceSetup.GetConnectionString(
            ConfigWith("Host=db;Database=evently;Username=u;Password=p;GSS Encryption Mode=Require"));

        new NpgsqlConnectionStringBuilder(result).GssEncryptionMode.ShouldBe(GssEncryptionMode.Require);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Missing_or_empty_connection_string_fails_fast(string? value)
    {
        Should.Throw<InvalidOperationException>(() => PersistenceSetup.GetConnectionString(ConfigWith(value)))
            .Message.ShouldContain("ConnectionStrings:Database");
    }
}

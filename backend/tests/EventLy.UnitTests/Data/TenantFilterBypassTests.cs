using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Shouldly;

namespace EventLy.UnitTests.Data;

/// <summary>
/// Turning off the tenant filter is allowed only in a short, reviewed list of places
/// (docs/architecture/01-system-architecture.md §5). A new use fails here until it is reviewed and added.
/// </summary>
public sealed partial class TenantFilterBypassTests
{
    /// <summary>File → why it may look across organizations.</summary>
    private static readonly Dictionary<string, string> AllowList = new()
    {
        ["Services/PaymentService.cs"] =
            "the webhook and reconciliation carry no user; Root's manual activation (Root has no organization)",
        ["Services/PlatformOwnerService.cs"] = "Root's Owner list and details (Root has no organization)",
        ["Services/PublicInvitationService.cs"] =
            "a guest has no sign-in: the invitation found by its code names the organization",
        ["Services/GuestResponseService.cs"] =
            "soft delete only: wishes and gift confirmations of deleted guests stay visible to the organizer",
    };

    [Fact]
    public void Only_allow_listed_files_ignore_query_filters()
    {
        var source = Path.Combine(RepositoryRoot(), "backend", "src", "EventLy.Api");
        var users = Directory.EnumerateFiles(source, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(f => File.ReadAllText(f).Contains(".IgnoreQueryFilters(", StringComparison.Ordinal))
            .Select(f => Path.GetRelativePath(source, f).Replace('\\', '/'))
            .Order(StringComparer.Ordinal)
            .ToList();

        users.ShouldBe([.. AllowList.Keys.Order(StringComparer.Ordinal)], customMessage: "Review the new IgnoreQueryFilters use, then add it here");
    }

    [Fact]
    public void Allow_listed_files_keep_the_soft_delete_filter_unless_they_name_it()
    {
        var source = Path.Combine(RepositoryRoot(), "backend", "src", "EventLy.Api");
        foreach (var file in AllowList.Keys)
        {
            // IgnoreQueryFilters() without names would also show soft-deleted rows; name the filters instead.
            BareIgnore().IsMatch(File.ReadAllText(Path.Combine(source, file))).ShouldBeFalse(file);
        }
    }

    [GeneratedRegex(@"\.IgnoreQueryFilters\(\)")]
    private static partial Regex BareIgnore();

    private static string RepositoryRoot([CallerFilePath] string thisFile = "")
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(thisFile)!);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "backend", "src")))
        {
            dir = dir.Parent;
        }
        return dir?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }
}

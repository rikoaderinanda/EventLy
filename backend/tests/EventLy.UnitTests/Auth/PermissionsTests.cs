using EventLy.Api.Auth;
using EventLy.Api.Entities;
using Shouldly;

namespace EventLy.UnitTests.Auth;

/// <summary>Pins the role rules from the spec and the decisions (Admin strict, Root platform-only).</summary>
public sealed class PermissionsTests
{
    [Theory]
    [InlineData(Permissions.PaymentManage)]
    [InlineData(Permissions.UsersManageAdmin)]
    [InlineData(Permissions.UsersManageStaff)]
    [InlineData(Permissions.EventAssignStaff)]
    [InlineData(Permissions.CheckInPerform)]
    [InlineData(Permissions.AuditView)]
    [InlineData(Permissions.OrganizationManage)]
    public void Admin_cannot(string permission) =>
        Permissions.For(UserRole.Admin).ShouldNotContain(permission);

    [Theory]
    [InlineData(Permissions.EventManage)]
    [InlineData(Permissions.GuestManage)]
    [InlineData(Permissions.InvitationManage)]
    [InlineData(Permissions.RsvpView)]
    [InlineData(Permissions.GalleryManage)]
    [InlineData(Permissions.ReportExport)]
    public void Admin_can(string permission) =>
        Permissions.For(UserRole.Admin).ShouldContain(permission);

    [Fact]
    public void Staff_can_only_view_events_check_in_and_upload_photos()
    {
        Permissions.For(UserRole.Staff).ShouldBe(
            [Permissions.CheckInPerform, Permissions.EventView, Permissions.OrganizationView, Permissions.PhotoUpload],
            ignoreOrder: true);
    }

    [Fact]
    public void Root_holds_only_platform_permissions()
    {
        Permissions.For(UserRole.Root).ShouldAllBe(p => p.StartsWith("platform.", StringComparison.Ordinal));
        Permissions.For(UserRole.Owner).ShouldNotContain(p => p.StartsWith("platform.", StringComparison.Ordinal));
    }

    [Fact]
    public void Owner_has_every_organization_permission()
    {
        var organizationPermissions = Permissions.Matrix.Keys.Where(p => !p.StartsWith("platform.", StringComparison.Ordinal));

        Permissions.For(UserRole.Owner).ShouldBe(organizationPermissions, ignoreOrder: true);
    }
}

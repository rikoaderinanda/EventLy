using EventLy.Api.Entities;

namespace EventLy.Api.Auth;

/// <summary>
/// The permission matrix (docs/architecture/01-system-architecture.md §7.3) in one place.
/// Each permission is registered as an authorization policy of the same name, so controllers use
/// <c>[Authorize(Policy = Permissions.X)]</c> instead of role names. Resource checks (for example
/// "staff is assigned to this event") happen in the services.
/// </summary>
public static class Permissions
{
    public const string PlatformPackagesManage = "platform.packages.manage";
    public const string PlatformOwnersManage = "platform.owners.manage";
    public const string PlatformEventsActivateManual = "platform.events.activate_manual";

    public const string OrganizationManage = "organization.manage";
    public const string OrganizationView = "organization.view";
    public const string UsersManageAdmin = "users.manage_admin";
    public const string UsersManageStaff = "users.manage_staff";

    public const string EventManage = "event.manage";
    public const string EventView = "event.view";
    public const string EventAssignStaff = "event.assign_staff";
    public const string EventCancel = "event.cancel";

    public const string PackageView = "package.view";
    public const string PaymentManage = "payment.manage";

    public const string GuestManage = "guest.manage";
    public const string InvitationManage = "invitation.manage";
    public const string RsvpView = "rsvp.view";

    public const string CheckInPerform = "checkin.perform";
    public const string PhotoUpload = "photo.upload";
    public const string GalleryManage = "gallery.manage";

    public const string DashboardView = "dashboard.view";
    public const string ReportExport = "report.export";
    public const string AuditView = "audit.view";

    private static readonly UserRole[] OwnerOnly = [UserRole.Owner];
    private static readonly UserRole[] OwnerAdmin = [UserRole.Owner, UserRole.Admin];

    /// <summary>Which roles hold each permission. Admin is kept strict, as the spec says (decision Q-3).</summary>
    public static readonly IReadOnlyDictionary<string, UserRole[]> Matrix = new Dictionary<string, UserRole[]>
    {
        [PlatformPackagesManage] = [UserRole.Root],
        [PlatformOwnersManage] = [UserRole.Root],
        [PlatformEventsActivateManual] = [UserRole.Root],

        [OrganizationManage] = OwnerOnly,
        [OrganizationView] = [UserRole.Owner, UserRole.Admin, UserRole.Staff],
        [UsersManageAdmin] = OwnerOnly,
        [UsersManageStaff] = OwnerOnly,

        [EventManage] = OwnerAdmin,
        [EventView] = [UserRole.Owner, UserRole.Admin, UserRole.Staff],
        [EventAssignStaff] = OwnerOnly,
        [EventCancel] = OwnerOnly,

        [PackageView] = OwnerAdmin,
        [PaymentManage] = OwnerOnly,

        [GuestManage] = OwnerAdmin,
        [InvitationManage] = OwnerAdmin,
        [RsvpView] = OwnerAdmin,

        [CheckInPerform] = [UserRole.Owner, UserRole.Staff],
        [PhotoUpload] = [UserRole.Owner, UserRole.Staff],
        [GalleryManage] = OwnerAdmin,

        [DashboardView] = OwnerAdmin,
        [ReportExport] = OwnerAdmin,
        [AuditView] = OwnerOnly,
    };

    public static IReadOnlyList<string> For(UserRole role) =>
        [.. Matrix.Where(p => p.Value.Contains(role)).Select(p => p.Key).Order(StringComparer.Ordinal)];
}

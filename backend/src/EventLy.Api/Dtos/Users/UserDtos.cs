using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Users;

public sealed record OrganizationUserDto(
    Guid Id,
    string Name,
    string Email,
    string? AvatarUrl,
    UserRole Role,
    UserStatus Status,
    DateTimeOffset? LastSignInAt,
    DateTimeOffset CreatedAt);

/// <summary>The Owner registers the Google email of an Admin or Staff member; they sign in with Google.</summary>
public sealed record InviteUserRequest(string Name, string Email, UserRole Role);

/// <summary>Status can only be Active or Disabled here; Invited ends with the person's first sign-in.</summary>
public sealed record UpdateUserRequest(string Name, UserRole Role, UserStatus Status);

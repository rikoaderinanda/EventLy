namespace EventLy.Api.Entities;

/// <summary>Set automatically by <see cref="Data.Interceptors.TimestampsInterceptor"/>.</summary>
public interface IHasTimestamps
{
    DateTimeOffset CreatedAt { get; set; }

    DateTimeOffset UpdatedAt { get; set; }
}

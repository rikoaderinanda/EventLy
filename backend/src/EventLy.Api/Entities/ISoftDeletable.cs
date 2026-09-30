namespace EventLy.Api.Entities;

/// <summary>Rows with <see cref="DeletedAt"/> set are hidden by a named global query filter (<c>soft_delete</c>).</summary>
public interface ISoftDeletable
{
    DateTimeOffset? DeletedAt { get; set; }
}

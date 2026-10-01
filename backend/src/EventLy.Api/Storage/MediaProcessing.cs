using SkiaSharp;

namespace EventLy.Api.Storage;

/// <summary>A photo ready to store: re-encoded JPEG without any metadata, and its thumbnail.</summary>
public sealed record ProcessedImage(byte[] Jpeg, byte[] Thumbnail, int Width, int Height);

/// <summary>
/// Upload hardening (docs/architecture/01-system-architecture.md §7): the type comes from the magic bytes,
/// never from the file name or Content-Type; the image is decoded and re-encoded, which drops EXIF (GPS
/// included) and anything hidden in the file. SkiaSharp (MIT) does the work.
/// </summary>
public static class ImageProcessor
{
    public const int MaxBytes = 15 * 1024 * 1024;
    public const int LongEdge = 2048;
    public const int ThumbnailEdge = 480;

    /// <summary>Refuses decompression bombs: a small file that would expand to a huge bitmap.</summary>
    private const long MaxPixels = 50_000_000;

    /// <summary>The processed image, or null when the bytes aren't a JPEG, PNG or WebP image we can read.</summary>
    public static ProcessedImage? Process(byte[] data, int longEdge = LongEdge)
    {
        if (data.Length is 0 or > MaxBytes || !IsSupportedImage(data))
        {
            return null;
        }

        using var codec = SKCodec.Create(new SKMemoryStream(data));
        if (codec is null || (long)codec.Info.Width * codec.Info.Height > MaxPixels)
        {
            return null;
        }

        using var decoded = SKBitmap.Decode(codec, codec.Info.WithColorType(SKColorType.Rgba8888).WithAlphaType(SKAlphaType.Premul));
        if (decoded is null)
        {
            return null;
        }

        using var upright = Orient(decoded, codec.EncodedOrigin);
        using var full = Fit(upright, longEdge);
        using var thumb = Fit(upright, ThumbnailEdge);
        return new ProcessedImage(Jpeg(full, 85), Jpeg(thumb, 75), full.Width, full.Height);
    }

    public static bool IsSupportedImage(ReadOnlySpan<byte> data) =>
        data.StartsWith((byte[])[0xFF, 0xD8, 0xFF])                                    // JPEG
        || data.StartsWith((byte[])[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])   // PNG
        || (data.Length >= 12 && data[..4].SequenceEqual("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8));

    private static byte[] Jpeg(SKBitmap bitmap, int quality)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, quality);
        return encoded.ToArray();
    }

    /// <summary>Scales down so the long edge is at most <paramref name="edge"/>; smaller images are copied as they are.</summary>
    private static SKBitmap Fit(SKBitmap source, int edge)
    {
        var scale = Math.Min(1.0, (double)edge / Math.Max(source.Width, source.Height));
        var info = new SKImageInfo(
            Math.Max(1, (int)Math.Round(source.Width * scale)),
            Math.Max(1, (int)Math.Round(source.Height * scale)),
            SKColorType.Rgba8888, SKAlphaType.Premul);
        return source.Resize(info, new SKSamplingOptions(SKCubicResampler.Mitchell)) ?? source.Copy();
    }

    /// <summary>Applies the EXIF orientation to the pixels, since the re-encoded file no longer carries it.</summary>
    private static SKBitmap Orient(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft)
        {
            return source.Copy();
        }

        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop
            or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var (w, h) = swap ? (source.Height, source.Width) : (source.Width, source.Height);
        var result = new SKBitmap(new SKImageInfo(w, h, source.ColorType, source.AlphaType));
        using var canvas = new SKCanvas(result);
        canvas.SetMatrix(origin switch
        {
            SKEncodedOrigin.TopRight => SKMatrix.CreateScale(-1, 1, w / 2f, 0),
            SKEncodedOrigin.BottomRight => SKMatrix.CreateRotationDegrees(180, w / 2f, h / 2f),
            SKEncodedOrigin.BottomLeft => SKMatrix.CreateScale(1, -1, 0, h / 2f),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, w, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, w, -1, 0, h, 0, 0, 1),
            SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, h, 0, 0, 1),
            _ => SKMatrix.Identity,
        });
        using var image = SKImage.FromBitmap(source);
        canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Linear));
        return result;
    }
}

/// <summary>Background music (decision Q-43): MP3 or M4A, at most 10 MB, recognised by the magic bytes.</summary>
public static class AudioCheck
{
    public const int MaxBytes = 10 * 1024 * 1024;

    private static readonly string[] Mp4Brands = ["M4A ", "M4B ", "mp42", "mp41", "isom", "iso2", "dash"];

    /// <summary>(content type, file extension), or null when the file isn't an MP3 or M4A.</summary>
    public static (string ContentType, string Extension)? Detect(ReadOnlySpan<byte> data)
    {
        if (data.Length is < 12 or > MaxBytes)
        {
            return null;
        }
        if (data.StartsWith("ID3"u8) || (data[0] == 0xFF && (data[1] & 0xE0) == 0xE0))
        {
            return ("audio/mpeg", "mp3");
        }
        if (data[4..8].SequenceEqual("ftyp"u8) && Mp4Brands.Contains(System.Text.Encoding.ASCII.GetString(data[8..12])))
        {
            return ("audio/mp4", "m4a");
        }
        return null;
    }
}

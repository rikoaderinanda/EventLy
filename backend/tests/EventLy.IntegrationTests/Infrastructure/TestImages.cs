using SkiaSharp;

namespace EventLy.IntegrationTests.Infrastructure;

/// <summary>Real image files for upload tests, made with SkiaSharp.</summary>
public static class TestImages
{
    public static byte[] Jpeg(int width = 3000, int height = 2000, SKColor? color = null) =>
        Encode(width, height, color ?? SKColors.SteelBlue, SKEncodedImageFormat.Jpeg);

    public static byte[] Png(int width = 400, int height = 300) => Encode(width, height, SKColors.Gold, SKEncodedImageFormat.Png);

    /// <summary>
    /// A JPEG with an EXIF block that holds GPS coordinates, like a phone photo. Stored photos must not
    /// carry it (the re-encode drops all metadata).
    /// </summary>
    public static byte[] JpegWithGps()
    {
        var jpeg = Jpeg(800, 600);
        var exif = "Exif\0\0GPSLatitude=-6.2088;GPSLongitude=106.8456"u8.ToArray();
        var length = exif.Length + 2;
        byte[] app1 = [0xFF, 0xE1, (byte)(length >> 8), (byte)(length & 0xFF), .. exif];
        return [.. jpeg[..2], .. app1, .. jpeg[2..]];
    }

    private static byte[] Encode(int width, int height, SKColor color, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(color);
            using var paint = new SKPaint { Color = SKColors.White };
            canvas.DrawRect(width / 4f, height / 4f, width / 2f, height / 2f, paint);
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }
}

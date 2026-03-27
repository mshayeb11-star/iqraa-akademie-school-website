Add-Type -AssemblyName System.Drawing

$root = "D:\Safaa Website\images"
$maxWidth = 1400
$jpegQuality = 78

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" }

function Save-JpegWithQuality {
    param(
        [System.Drawing.Image]$Image,
        [string]$OutPath,
        [int]$Quality
    )

    $encoder = [System.Drawing.Imaging.Encoder]::Quality
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, [long]$Quality)
    $Image.Save($OutPath, $jpegCodec, $encoderParams)
    $encoderParams.Dispose()
}

function Resize-Image {
    param(
        [string]$FilePath
    )

    try {
        $image = [System.Drawing.Image]::FromFile($FilePath)

        $newWidth = $image.Width
        $newHeight = $image.Height

        if ($image.Width -gt $maxWidth) {
            $ratio = $maxWidth / $image.Width
            $newWidth = [int]($image.Width * $ratio)
            $newHeight = [int]($image.Height * $ratio)
        }

        $bitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $newWidth, $newHeight)

        $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
        $directory = [System.IO.Path]::GetDirectoryName($FilePath)
        $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($FilePath)

        $outPath = Join-Path $directory ($nameWithoutExt + "-opt.jpg")

        Save-JpegWithQuality -Image $bitmap -OutPath $outPath -Quality $jpegQuality

        $graphics.Dispose()
        $bitmap.Dispose()
        $image.Dispose()

        Write-Host "Optimized: $FilePath -> $outPath"
    }
    catch {
        Write-Host "Failed: $FilePath"
    }
}

Get-ChildItem -Path $root -Recurse -File |
    Where-Object { $_.Extension -match "\.(jpg|jpeg|png)$" } |
    ForEach-Object {
        Resize-Image -FilePath $_.FullName
    }

Write-Host ""
Write-Host "Done."
Write-Host "All optimized files were saved with -opt.jpg"
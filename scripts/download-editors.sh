#!/bin/bash

# Download Rich Text Editor Libraries for Salesforce Static Resources
# This script downloads Quill.js, TinyMCE, and CKEditor 5 and packages them for Salesforce

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
STATIC_RESOURCES_DIR="$PROJECT_DIR/force-app/main/default/staticresources"
TEMP_DIR="$PROJECT_DIR/temp_editors"

echo "Creating temp directory..."
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# ==================== QUILL.JS ====================
echo ""
echo "=========================================="
echo "Downloading Quill.js..."
echo "=========================================="

mkdir -p quilljs
cd quilljs

# Download Quill minified JS and CSS
curl -L -o quill.min.js "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js"
curl -L -o quill.snow.css "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css"
curl -L -o quill.bubble.css "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.bubble.css"

echo "Packaging Quill.js..."
cd ..
zip -r quilljs.zip quilljs/
mv quilljs.zip "$STATIC_RESOURCES_DIR/quilljs.resource"
echo "Quill.js packaged successfully!"

# ==================== TINYMCE ====================
echo ""
echo "=========================================="
echo "Downloading TinyMCE..."
echo "=========================================="

# Download TinyMCE self-hosted package
curl -L -o tinymce.zip "https://download.tiny.cloud/tinymce/community/tinymce_6.8.4.zip"
unzip -q tinymce.zip
mv tinymce/js/tinymce tinymce_clean
rm -rf tinymce tinymce.zip

# Repackage with correct structure
mkdir tinymce
mv tinymce_clean/* tinymce/

echo "Packaging TinyMCE..."
zip -r tinymce.zip tinymce/
mv tinymce.zip "$STATIC_RESOURCES_DIR/tinymce.resource"
echo "TinyMCE packaged successfully!"

# ==================== CKEDITOR 5 ====================
echo ""
echo "=========================================="
echo "Downloading CKEditor 5..."
echo "=========================================="

mkdir -p ckeditor5
cd ckeditor5

# Download CKEditor 5 UMD build from CDN
curl -L -o ckeditor5.umd.js "https://cdn.ckeditor.com/ckeditor5/43.3.0/ckeditor5.umd.js"
curl -L -o ckeditor5.css "https://cdn.ckeditor.com/ckeditor5/43.3.0/ckeditor5.css"

echo "Packaging CKEditor 5..."
cd ..
zip -r ckeditor5.zip ckeditor5/
mv ckeditor5.zip "$STATIC_RESOURCES_DIR/ckeditor5.resource"
echo "CKEditor 5 packaged successfully!"

# ==================== CLEANUP ====================
echo ""
echo "Cleaning up..."
cd "$PROJECT_DIR"
rm -rf "$TEMP_DIR"

echo ""
echo "=========================================="
echo "All editors downloaded and packaged!"
echo "=========================================="
echo ""
echo "Static resources created:"
ls -la "$STATIC_RESOURCES_DIR"/*.resource 2>/dev/null || echo "No .resource files found"
echo ""
echo "Next steps:"
echo "1. Deploy to your org: sf project deploy start --target-org richText"
echo "2. Assign permission set: sf org assign permset --name Rich_Text_Editor_User"
echo "3. Create a Rich Text Document record"
echo "4. Navigate to the record to use the evaluation harness"

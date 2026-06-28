package files

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// ZipDir writes a zip of srcDir's contents to dest. Entry names are relative to srcDir.
func ZipDir(dest, srcDir string) error {
	return writeZip(dest, func(zw *zip.Writer) error {
		return filepath.WalkDir(srcDir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				return nil
			}
			rel, err := filepath.Rel(srcDir, path)
			if err != nil {
				return err
			}
			return addFile(zw, path, filepath.ToSlash(rel))
		})
	})
}

// ZipFiles writes a zip of the given files to dest, naming entries relative to baseDir.
func ZipFiles(dest, baseDir string, files []string) error {
	return writeZip(dest, func(zw *zip.Writer) error {
		for _, f := range files {
			name := filepath.Base(f)
			if rel, err := filepath.Rel(baseDir, f); err == nil && !strings.HasPrefix(rel, "..") {
				name = filepath.ToSlash(rel)
			}
			if err := addFile(zw, f, name); err != nil {
				return err
			}
		}
		return nil
	})
}

func writeZip(dest string, fn func(*zip.Writer) error) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	zw := zip.NewWriter(out)
	if err := fn(zw); err != nil {
		_ = zw.Close()
		return err
	}
	return zw.Close()
}

func addFile(zw *zip.Writer, srcPath, entryName string) error {
	in, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer in.Close()
	w, err := zw.Create(entryName)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, in)
	return err
}

function imageCompression(file: File | Blob, options?: any): Promise<File | Blob> {
  return Promise.resolve(file);
}

export default imageCompression;
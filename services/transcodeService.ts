const TRANSCODABLE_EXTENSIONS = ['.mkv', '.mov', '.avi', '.wmv', '.flv', '.webm'];

export const transcodeService = {
    isTranscodable: (filename: string): boolean => {
        const lowerCaseName = filename.toLowerCase();
        return TRANSCODABLE_EXTENSIONS.some(ext => lowerCaseName.endsWith(ext));
    },
};

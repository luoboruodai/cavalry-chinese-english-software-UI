//! Family names only: no font files, document contents or personal file paths leave the app.
#[cfg(target_os = "macos")]
pub fn families() -> Vec<String> {
    use std::ffi::{c_char, c_void};
    #[link(name = "CoreText", kind = "framework")]
    extern "C" {
        fn CTFontManagerCopyAvailableFontFamilyNames() -> *const c_void;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFArrayGetCount(array: *const c_void) -> isize;
        fn CFArrayGetValueAtIndex(array: *const c_void, index: isize) -> *const c_void;
        fn CFStringGetCString(
            string: *const c_void,
            buffer: *mut c_char,
            size: isize,
            encoding: u32,
        ) -> bool;
        fn CFRelease(value: *const c_void);
    }
    let mut names = Vec::new();
    unsafe {
        let array = CTFontManagerCopyAvailableFontFamilyNames();
        if array.is_null() {
            return names;
        }
        for i in 0..CFArrayGetCount(array) {
            let mut buffer = [0i8; 1024];
            if CFStringGetCString(
                CFArrayGetValueAtIndex(array, i),
                buffer.as_mut_ptr(),
                buffer.len() as isize,
                0x08000100,
            ) {
                let value = std::ffi::CStr::from_ptr(buffer.as_ptr())
                    .to_string_lossy()
                    .into_owned();
                if !value.starts_with('.') {
                    names.push(value);
                }
            }
        }
        CFRelease(array);
    }
    names.sort();
    names.dedup();
    names
}
#[cfg(not(any(target_os = "macos", windows)))]
pub fn families() -> Vec<String> {
    Vec::new()
}

#[cfg(windows)]
pub fn families() -> Vec<String> { cbpatch::windows::families() }

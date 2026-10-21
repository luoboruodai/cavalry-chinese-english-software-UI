#include <windows.h>
#include <stdio.h>

int main(void) {
    HMODULE module = LoadLibraryW(L"comctl32.dll");
    if (module == NULL) {
        fprintf(stderr, "comctl32.dll could not be loaded\n");
        return 90;
    }
    FARPROC entry = GetProcAddress(module, "TaskDialogIndirect");
    if (entry == NULL) {
        fprintf(stderr, "TaskDialogIndirect is unavailable\n");
        return 2;
    }
    puts("TaskDialogIndirect is available");
    return 0;
}

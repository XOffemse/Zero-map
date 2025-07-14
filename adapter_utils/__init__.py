import platform

if platform.system() == "Windows":
    from .windows.windows_adapters import get_adapters_windows as get_adapters # type: ignore
elif platform.system() == "Linux":
    from .linux.linux_adapters import get_adapters_linux as get_adapters
else:
    raise NotImplementedError("Unsupported OS")

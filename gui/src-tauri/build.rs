fn main() {
    println!("cargo:rerun-if-changed=cavalry-bilingual.rc");
    println!("cargo:rerun-if-changed=cavalry-bilingual.exe.manifest");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        embed_resource::compile("cavalry-bilingual.rc", embed_resource::NONE)
            .manifest_required()
            .expect("Cavalry Bilingual requires the Common Controls v6 manifest on Windows");
    }
}

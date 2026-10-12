fn main(){let app=std::env::args().nth(1).expect("app path");match cbpatch::assets::prepare(std::path::Path::new(&app),&cbpatch::config::Settings::default()){
    Ok((_,count))=>println!("Validated {count} display-string changes; no files written"),Err(error)=>{eprintln!("{error}");std::process::exit(1);}
}}

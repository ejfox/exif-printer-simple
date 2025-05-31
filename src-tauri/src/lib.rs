use tauri::Manager;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[tauri::command]
async fn select_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let folder = app.dialog().file()
        .set_title("Select folder to save prints")
        .blocking_pick_folder();
    
    Ok(folder.map(|p| p.into_path().unwrap().display().to_string()))
}

#[derive(serde::Deserialize)]
struct FileData {
    filename: String,
    #[serde(rename = "dataURL")]
    data_url: String,
}

#[tauri::command]
async fn download_files(files: Vec<FileData>, directory: String) -> Result<serde_json::Value, String> {
    let dir_path = Path::new(&directory);
    
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    for file in &files {
        // Remove the data URL prefix to get just the base64 data
        let base64_data = file.data_url
            .strip_prefix("data:image/png;base64,")
            .ok_or_else(|| "Invalid data URL format".to_string())?;
        
        // Decode base64 to bytes
        let image_data = BASE64.decode(base64_data)
            .map_err(|e| format!("Failed to decode base64: {}", e))?;
        
        // Write file
        let file_path = dir_path.join(&file.filename);
        tokio::fs::write(&file_path, &image_data).await
            .map_err(|e| format!("Failed to write file {}: {}", file.filename, e))?;
    }
    
    Ok(serde_json::json!({
        "success": true,
        "count": files.len(),
        "directory": directory
    }))
}

#[tauri::command]
async fn import_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let files = app.dialog().file()
        .set_title("Select photos to import")
        .add_filter("Images", &["jpg", "jpeg", "png", "tiff", "tif", "bmp", "webp"])
        .blocking_pick_files();
    
    match files {
        Some(file_paths) => {
            let paths: Vec<String> = file_paths
                .into_iter()
                .map(|p| p.into_path().unwrap().display().to_string())
                .collect();
            Ok(paths)
        }
        None => Ok(vec![])
    }
}

#[tauri::command]
async fn import_folder(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    let folder = app.dialog().file()
        .set_title("Select folder containing photos")
        .blocking_pick_folder();
    
    match folder {
        Some(folder_path) => {
            let folder_path = folder_path.into_path().unwrap();
            let mut image_paths = Vec::new();
            
            if let Ok(entries) = std::fs::read_dir(&folder_path) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_file() {
                            let path = entry.path();
                            if let Some(extension) = path.extension() {
                                let ext = extension.to_string_lossy().to_lowercase();
                                if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "tiff" | "tif" | "bmp" | "webp") {
                                    image_paths.push(path.display().to_string());
                                }
                            }
                        }
                    }
                }
            }
            
            Ok(image_paths)
        }
        None => Ok(vec![])
    }
}

#[tauri::command]
async fn read_file_as_bytes(file_path: String) -> Result<Vec<u8>, String> {
    tokio::fs::read(&file_path).await
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))
}

#[tauri::command]
async fn open_in_finder(folder_path: String) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(serde_json::json!({ "success": true }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![select_directory, download_files, open_in_finder, import_files, import_folder, read_file_as_bytes])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

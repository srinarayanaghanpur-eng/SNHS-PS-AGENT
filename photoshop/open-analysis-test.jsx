#target photoshop
(function(){var root=new Folder("E:/AI AGENTS/SNHS SMART POSTER AGENT/outputs/psd");Folder.current=root;var f=File.openDialog("Select a generated SNHS PSD", "Photoshop:*.psd");if(!f)throw new Error("No analysis test PSD selected.");app.open(f);}());

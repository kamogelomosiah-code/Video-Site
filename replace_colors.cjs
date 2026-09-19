const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    filelist = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkSync(path.join(dir, file), filelist)
      : filelist.concat(path.join(dir, file));
  });
  return filelist;
};

const files = walkSync('./components').concat(walkSync('./pages')).concat(['App.tsx']);

files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts')).forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace red with yellow
    content = content.replace(/red-600/g, 'yellow-500');
    content = content.replace(/red-500/g, 'yellow-400');
    content = content.replace(/red-400/g, 'yellow-300');
    content = content.replace(/red-700/g, 'yellow-600');
    content = content.replace(/rose-700/g, 'yellow-600');
    content = content.replace(/bg-zinc-950/g, 'bg-black');
    content = content.replace(/bg-zinc-900/g, 'bg-[#111]');
    
    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log(`Updated ${file}`);
    }
  } catch(e) {}
});

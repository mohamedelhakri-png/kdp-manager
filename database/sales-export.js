export function salesToCsv(sales) {
  const columns=["id","book_id","book_title","sale_date","units","royalties","currency","source"];
  const safe=value=>{
    let text=String(value??"");
    if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return "\uFEFF"+columns.join(",")+"\r\n"+sales.map(s=>columns.map(k=>safe(k==="sale_date"?String(s[k]??"").slice(0,10):s[k])).join(",")).join("\r\n")+(sales.length?"\r\n":"");
}

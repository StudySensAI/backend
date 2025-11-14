export function combineDocuments(docs:any[]){
    return docs.map((doc)=>doc.pageContent).join('\n\n')
}
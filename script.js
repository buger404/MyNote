var mdEditor = new SimpleMDE(
    {
        element: document.getElementById("markdown-editor"),
        spellChecker: false
    });

class MessageBox{
    constructor(element){
        this.box = element;
        this.title = document.getElementById(element.id + "-title");
        this.content = document.getElementById(element.id + "-content");
        this.yesBtn = document.getElementById(element.id + "-yes");
        this.noBtn = document.getElementById(element.id + "-no");

        this.yesBtn.onclick = () => this.finish(true);
        this.noBtn.onclick = () => this.finish(false);
    }

    show(title, content, callback = null, yesBtn = "确定", noBtn = ""){
        if (noBtn === ""){
            this.yesBtn.style.display = "none";
            this.noBtn.innerText = yesBtn;
        } else {
            this.yesBtn.style.display = "block";
            this.yesBtn.innerText = yesBtn;
            this.noBtn.innerText = noBtn;
        }
        this.title.innerText = title;
        this.content.innerText = content;
        this.box.style.display = "flex";

        this.callback = callback;
    }

    finish(operation) {
        this.box.style.display = "none";
        if (this.callback != null) {
            this.callback(operation);
        }
    }
}

class InputBox{
    constructor(element){
        this.box = element;
        this.title = document.getElementById(element.id + "-title");
        this.okBtn = document.getElementById(element.id + "-ok");
        this.noBtn = document.getElementById(element.id + "-no");
        this.inputBox = document.getElementById(element.id + "-input");

        this.noBtn.onclick = () => this.finish(null);
        this.okBtn.onclick = () => this.finish(this.inputBox.value);
    }

    show(title, callback = null, okBtn = "确定", defaultInput = ""){
        this.inputBox.value = defaultInput;

        this.title.innerText = title;
        this.okBtn.innerText = okBtn;
        this.box.style.display = "flex";

        this.callback = callback;
    }

    finish(input) {
        this.box.style.display = "none";
        if (this.callback != null) {
            this.callback(input);
        }
    }
}

class NoteManager{
    categoryDict = new Map();
    noteDict = new Map();
    noteDirty = new Map();
    lastSelectedNote;
    lastSelectedCategory;
    currentCategory;
    currentNote = "";

    constructor(storageKey) {
        this.categoryTemplate = document.getElementById("custom-category-template");
        this.categorySpace = document.getElementById("category-content-panel");
        this.noteContainer = document.getElementById("note-content-panel");
        this.noteTitle = document.getElementById("note-title");
        this.noteEditTime = document.getElementById("note-edit-time");
        this.noteInfo = document.getElementById("note-info");
        this.createNoteButton = document.getElementById("note-create-button");
        this.editorTextArea = mdEditor.codemirror.display.wrapper.querySelector("textarea");

        this.noneEditPanel = document.getElementById("none-edit-panel");
        this.editPanel = document.getElementById("edit-panel");

        this.categoryStorageKey = storageKey + "-category";
        this.noteStorageKey = storageKey + "-note";

        this.loadCategories();
        this.loadNotes();

        const specialCategories = ["all", "other", "dustbin"];
        for(let category of specialCategories){
            let node = document.getElementById("category-" + category);
            this.categoryDict.set(category, node);
            node.onclick = () => {
                this.selectCategory(category);
            }
        }
        this.selectCategory("all");

        mdEditor.codemirror.on("change", () => this.updateDirtyState());
    }

    updateDirtyState(){
        if (this.currentNote !== ""){
            this.noteDirty.set(this.currentNote, true);
        }
    }

    checkCurrentNoteDirty(callback){
        if (this.currentNote === ""){
            callback();
            return;
        }
        if (this.noteDirty.get(this.currentNote)){
            msgBox.show("当前笔记未保存", "内容尚未保存，您确定要离开吗？", (operation) => {
                if (operation){
                    this.noteDirty.set(this.currentNote, false);
                    callback();
                }
            }, "放弃更改", "取消");
        }else{
            callback();
        }
    }

    getNoteById(id) {
        return this.notes.find(x => x.id === id);
    }

    updateCurrentNote(){
        const note = this.getNoteById(this.currentNote);
        if (note) {
            Object.assign(note,{
                title: this.noteTitle.value,
                content: mdEditor.value(),
                lastModified: new Date().toISOString()
            });
            this.noteDirty.set(this.currentNote, false);
            this.noteDict.get(this.currentNote).innerText = note.title || "未命名笔记";
            this.saveNotes();
            this.selectNote(null);
        }
    }

    selectNote(note){
        if (this.currentNote === note?.id){
            return;
        }
        this.checkCurrentNoteDirty(() => {
            if (this.lastSelectedNote != null){
                this.lastSelectedNote.classList.remove("active");
            }
            if (note == null){
                this.lastSelectedNote = null;
                this.currentNote = "";
                this.noneEditPanel.style.display = "flex";
                this.editPanel.style.display = "none";
                return;
            }
            this.lastSelectedNote = this.noteDict.get(note.id);
            this.lastSelectedNote.classList.add("active");
            this.currentNote = note.id;
            this.noneEditPanel.style.display = "none";
            this.editPanel.style.display = "flex";
            this.noteTitle.value = note.title;
            mdEditor.value(note.content);
            this.noteDirty.set(note.id, false);
            this.editorTextArea.disabled = note.category === "dustbin";

            mdEditor.codemirror.refresh();

            this.noteEditTime.innerText = `最后编辑时间：${note.lastModified}`;
        });
    }

    loadNotes(){
        const noteJson = localStorage.getItem(this.noteStorageKey);
        this.notes = noteJson ? JSON.parse(noteJson) : [];
        for(let note of this.notes){
            this.noteDirty.set(note.id, false);
        }
    }

    saveNotes(){
        localStorage.setItem(this.noteStorageKey, JSON.stringify(this.notes));
    }

    createNote(title = "", content = "") {
        let category = this.currentCategory;
        if (category === "all"){
            category = "other";
        }
        const note = {
            id: Date.now(), // 唯一ID
            category: category,
            title: title,
            content: content,
            lastModified: new Date().toISOString() // 创建时设置 lastModified
        };
        this.noteDirty.set(note.id, false);
        this.notes.push(note);
        this.renderNote(note);
        this.saveNotes();
        this.selectNote(note);
        this.noteInfo.innerText = `共 ${this.noteContainer.childNodes.length - 1} 条笔记`;
        return note;
    }

    renderNotes(category){
        for(let note of this.noteDict.values()){
            note.parentNode.removeChild(note);
        }
        this.noteDict.clear();
        this.currentNote = "";
        this.lastSelectedNote = null;
        this.createNoteButton.style.display = (category === "dustbin") ? "none" : "block";
        let notes = this.notes.filter(x => x.category === category || category === "all");
        this.noteInfo.innerText = `共 ${notes.length} 条笔记`;
        for(let note of notes){
            this.renderNote(note);
        }
    }

    renderNote(note){
        var node = document.createElement("p");
        node.classList.add("note-item")
        node.innerText = note.title || "未命名笔记";
        node.onclick = () => {
            this.selectNote(note);
        }
        this.noteDict.set(note.id, node);
        this.noteContainer.appendChild(node);
    }

    selectCategory(id) {
        if (this.lastSelectedCategory != null){
            this.lastSelectedCategory.classList.remove("active");
        }
        this.lastSelectedCategory = this.categoryDict.get(id);
        this.lastSelectedCategory.classList.add("active");
        this.currentCategory = id;
        this.renderNotes(id);
    }

    deleteCategory(id) {
        const index = this.categories.findIndex(x => x.id === id);
        if (index !== -1) {
            this.categories.splice(index, 1);
            this.saveCategory();
            return true;
        }
        return false;
    }

    createCategory(title){
        const category = {
            id: Date.now(),
            title: title
        };
        this.categories.push(category);
        this.saveCategory();
        this.renderCategory(category);
        return category;
    }

    loadCategories(){
        const categoryJson = localStorage.getItem(this.categoryStorageKey);
        this.categories = categoryJson ? JSON.parse(categoryJson) : [];
        for(let category of this.categories){
            this.renderCategory(category);
        }
    }

    saveCategory(){
        localStorage.setItem(this.categoryStorageKey, JSON.stringify(this.categories));
    }

    renderCategory(category){
        var node = this.categoryTemplate.cloneNode(true);
        node.id = "";
        node.style.display = "flex";
        node.querySelector("span").innerText = category.title;
        node.querySelector(".edit-button").addEventListener("click", (event) => {
            event.stopPropagation();
            inputBox.show("修改分类名称", (name) => {
                if (name == null || name === ""){
                    msgBox.show("错误", "分类名称不能为空。");
                    return;
                }
                category.title = name;
                node.querySelector("span").innerText = name;
                this.saveCategory();
            }, "确定修改", category.title);
        });
        node.querySelector(".delete-button").addEventListener("click", (event) => {
            event.stopPropagation();
            msgBox.show("⚠ 确认要删除这个分类？", "该分类下的笔记将移动至【未分类】，此操作不可逆！", (op) => {
                if (op){
                    if (this.lastSelectedCategory === node){
                        this.selectCategory("all");
                    }
                    this.categoryDict.delete(node);
                    this.deleteCategory(category.id);
                    node.parentNode.removeChild(node);
                    msgBox.show("分类已删除", "");
                }
            }, "确定删除", "我再想想");
        });
        node.onclick = () => {
            this.selectCategory(category.id);
        }
        this.categoryDict.set(category.id, node);
        this.categorySpace.appendChild(node);
    }
}

var msgBox = new MessageBox(document.getElementById("msgbox"));
var inputBox = new InputBox(document.getElementById("inputbox"));

var noteManager = new NoteManager("myNote");

function deleteNote(){
    msgBox.show("⚠ 确认要删除这条笔记？", "此操作不可逆！", (op) => {
        msgBox.show("你选择了", op);
    }, "确定删除", "我再想想");
}

function createCategory(){
    inputBox.show("请输入新分类的名称", (name) => {
        if (name == null || name === ""){
            return;
        }
        noteManager.createCategory(name);
        msgBox.show("分类创建成功", "可以将笔记移动至喜欢的分类。");
    }, "创建分类");
}

function createNote(){
    noteManager.createNote();
}

function updateNote(){
    noteManager.updateCurrentNote();
}
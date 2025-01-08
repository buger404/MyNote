var mdEditor = new SimpleMDE(
    {
        element: document.getElementById("markdown-editor"),
        spellChecker: false
    });

const CATEGORY_ALL = "all";
const CATEGORY_OTHER = "other";
const CATEGORY_DUSTBIN = "dustbin";

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

        this.normalEditToolbar = document.getElementById("edit-normal-toolbar");
        this.dustbinEditToolbar = document.getElementById("edit-dustbin-toolbar");

        this.categoryStorageKey = storageKey + "-category";
        this.noteStorageKey = storageKey + "-note";

        this.loadCategories();
        this.loadNotes();

        const specialCategories = [CATEGORY_ALL, CATEGORY_OTHER, CATEGORY_DUSTBIN];
        for(let category of specialCategories){
            let node = document.getElementById("category-" + category);
            this.categoryDict.set(category, node);
            node.onclick = () => {
                this.selectCategory(category);
            }
        }
        this.selectCategory(CATEGORY_ALL);

        mdEditor.codemirror.on("change", () => this.updateDirtyState());
    }

    deleteNote(id){
        const index = this.notes.findIndex(x => x.id === id);
        if (index !== -1) {
            this.notes.splice(index, 1);
            this.saveNotes();
            return true;
        }
        return false;
    }

    moveNoteCategory(noteId, category){
        const note = this.getNoteById(noteId);
        if (note) {
            if (note.category === category) {
                return;
            }
            Object.assign(note,{
                category: category
            });
            let render = this.noteDict.get(noteId);
            if (render && (this.currentCategory !== CATEGORY_ALL || category === CATEGORY_DUSTBIN)){
                render.parentNode.removeChild(render);
                this.noteDict.delete(noteId);
            }
            this.saveNotes();
            this.updateNoteInfo();
        }
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
            let render = this.noteDict.get(this.currentNote);
            if (render){
                render.innerText = note.title || "未命名笔记";
            }
            this.saveNotes();
            this.selectNote(null);
        }
    }

    selectNote(note){
        if (this.currentNote === note?.id){
            return;
        }
        this.checkCurrentNoteDirty(() => {
            if (this.lastSelectedNote != null && this.lastSelectedNote){
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
            this.editorTextArea.disabled = note.category === CATEGORY_DUSTBIN;

            this.normalEditToolbar.style.display = (note.category === CATEGORY_DUSTBIN) ? "none" : "flex";
            this.dustbinEditToolbar.style.display = (note.category === CATEGORY_DUSTBIN) ? "flex" : "none";

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

    updateNoteInfo(){
        this.noteInfo.innerText = `共 ${this.noteContainer.childNodes.length - 1} 条笔记`;
    }

    createNote(title = "", content = "") {
        let category = this.currentCategory;
        if (category === CATEGORY_ALL){
            category = CATEGORY_OTHER;
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
        this.updateNoteInfo();
        return note;
    }

    renderNotes(category){
        for(let note of this.noteDict.values()){
            note.parentNode.removeChild(note);
        }
        this.noteDict.clear();
        let notes = this.notes.filter(x => {
            if (category === CATEGORY_ALL){
                return x.category !== CATEGORY_DUSTBIN;
            }
            return x.category === category;
        });
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
        if (note.id === this.currentNote){
            node.classList.add("active");
            this.lastSelectedNote = node;
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
        this.createNoteButton.style.display = (id === CATEGORY_DUSTBIN) ? "none" : "block";
        this.renderNotes(id);
    }

    deleteCategory(id) {
        const index = this.categories.findIndex(x => x.id === id);
        if (index !== -1) {
            this.categories.splice(index, 1);
            this.saveCategory();
            for(let note of this.notes.filter(x => x.category === id)){
                note.category = CATEGORY_OTHER;
            }
            this.saveNotes();
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
                        this.selectCategory(CATEGORY_ALL);
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

function moveCurrentNoteToDustbin(){
    noteManager.checkCurrentNoteDirty(() => {
        msgBox.show("⚠ 确定要删除这条笔记？", "笔记将放置到回收站中，您稍后可以在回收站中找回。", (op) => {
            if (!op){
                return;
            }
            noteManager.moveNoteCategory(noteManager.currentNote, CATEGORY_DUSTBIN);
            noteManager.selectNote(null);
        }, "移至回收站", "我再想想");
    });
}

function moveOutCurrentNoteFromDustbin(){
    noteManager.checkCurrentNoteDirty(() => {
        noteManager.moveNoteCategory(noteManager.currentNote, CATEGORY_OTHER);
        noteManager.selectNote(null);
        msgBox.show("还原成功", "已将当前笔记移至未分类笔记。");
    });
}

function deleteCurrentNote(){
    msgBox.show("⚠ 确认要删除这条笔记？", "此操作不可逆！", (op) => {
        if (!op){
            return;
        }
        noteManager.deleteNote(noteManager.currentNote);
        noteManager.noteDirty.set(noteManager.currentNote, false);
        let node = noteManager.noteDict.get(noteManager.currentNote);
        if (node){
            node.parentNode.removeChild(node);
            noteManager.noteDict.delete(noteManager.currentNote);
        }
        noteManager.selectNote(null);
    }, "确定删除", "我再想想");
}
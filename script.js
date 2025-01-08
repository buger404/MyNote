var mdEditor = new SimpleMDE(
    {
        element: document.getElementById("markdown-editor"),
        spellChecker: false
    });

// 基本分类常量
const CATEGORY_ALL = "all";
const CATEGORY_OTHER = "other";
const CATEGORY_DUSTBIN = "dustbin";

// 消息框封装
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

    // 弹出对话框
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

    // 内部完成回调
    finish(operation) {
        this.box.style.display = "none";
        if (this.callback != null) {
            this.callback(operation);
        }
    }
}

// 输入框封装
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

    // 弹出输入框
    show(title, callback = null, okBtn = "确定", defaultInput = ""){
        this.inputBox.value = defaultInput;

        this.title.innerText = title;
        this.okBtn.innerText = okBtn;
        this.box.style.display = "flex";

        this.callback = callback;
    }

    // 内部完成回调
    finish(input) {
        this.box.style.display = "none";
        if (this.callback != null) {
            this.callback(input);
        }
    }
}

// 笔记管理器
class NoteManager{
    categoryDict = new Map();   // 分类 id -> element
    noteDict = new Map();       // 笔记 id -> element
    noteDirty = new Map();      // 笔记 id -> bool，记录笔记是否是脏的

    lastSelectedNote;           // 上次选择的笔记的 element
    lastSelectedCategory;       // 上次选择的分类的 element
    currentCategory;            // 当前分类 ID
    currentNote = -1;   // 当前笔记 ID

    searchKeyword = "";  // 搜索关键字

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

        // 初始化基本分类
        const basicCategories = [CATEGORY_ALL, CATEGORY_OTHER, CATEGORY_DUSTBIN];
        for(let category of basicCategories){
            let node = document.getElementById("category-" + category);
            this.categoryDict.set(category, node);
            node.onclick = () => {
                this.selectCategory(category);
            }
            if (category !== CATEGORY_ALL){
                this.registerCategoryDragEvent(node, category);
            }
        }
        this.selectCategory(CATEGORY_ALL);

        // 注册编辑器内容改变回调，更新笔记脏状态
        mdEditor.codemirror.on("change", () => this.updateDirtyState());
    }

    // 删除笔记
    deleteNote(id){
        const index = this.notes.findIndex(x => x.id === id);
        if (index !== -1) {
            this.notes.splice(index, 1);
            this.saveNotes();
            return true;
        }
        return false;
    }

    // 移动笔记分类
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
            // 如果对应笔记在显示中，应该移掉它
            if (render && (this.currentCategory !== CATEGORY_ALL || category === CATEGORY_DUSTBIN)){
                render.parentNode.removeChild(render);
                this.noteDict.delete(noteId);
            }
            this.saveNotes();
            this.updateNoteInfo();
        }
    }

    // 更新当前笔记脏状态
    updateDirtyState(){
        if (this.currentNote !== -1){
            this.noteDirty.set(this.currentNote, true);
        }
    }

    // 检查当前笔记是不是脏的
    checkCurrentNoteDirty(callback){
        if (this.currentNote === -1){
            callback();
            return;
        }
        // 如果是脏的，则先询问是否放弃修改
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

    // 获取笔记
    getNoteById(id) {
        return this.notes.find(x => x.id === id);
    }

    // 更新当前笔记
    updateCurrentNote(){
        const note = this.getNoteById(this.currentNote);
        if (note) {
            Object.assign(note,{
                title: this.noteTitle.value,
                content: mdEditor.value(),
                lastModified: new Date().toISOString()
            });
            this.noteDirty.set(this.currentNote, false);
            // 更新标题
            let render = this.noteDict.get(this.currentNote);
            if (render){
                render.innerText = note.title || "未命名笔记";
            }
            this.saveNotes();
            this.selectNote(null);
        }
    }

    // 选择笔记
    selectNote(note){
        if (this.currentNote === note?.id){
            return;
        }
        this.checkCurrentNoteDirty(() => {
            // 更新样式
            if (this.lastSelectedNote != null && this.lastSelectedNote){
                this.lastSelectedNote.classList.remove("active");
            }
            if (note == null){
                // 如果不选择笔记，则是关闭笔记编辑器
                this.lastSelectedNote = null;
                this.currentNote = -1;
                this.noneEditPanel.style.display = "flex";
                this.editPanel.style.display = "none";
                return;
            }
            this.lastSelectedNote = this.noteDict.get(note.id);
            this.lastSelectedNote.classList.add("active");
            this.currentNote = note.id;

            // 初始化编辑器
            this.noneEditPanel.style.display = "none";
            this.editPanel.style.display = "flex";
            this.noteTitle.value = note.title;
            mdEditor.value(note.content);
            this.noteDirty.set(note.id, false); // 由于设置编辑器内容时会触发一次 脏状态 更新，这里要设置一次
            this.editorTextArea.disabled = note.category === CATEGORY_DUSTBIN;

            this.normalEditToolbar.style.display = (note.category === CATEGORY_DUSTBIN) ? "none" : "flex";
            this.dustbinEditToolbar.style.display = (note.category === CATEGORY_DUSTBIN) ? "flex" : "none";

            mdEditor.codemirror.refresh(); // 没有这行的话，编辑器内容显示不完全

            this.noteEditTime.innerText = `最后编辑时间：${note.lastModified}`;
        });
    }

    // 加载全部笔记
    loadNotes(){
        const noteJson = localStorage.getItem(this.noteStorageKey);
        this.notes = noteJson ? JSON.parse(noteJson) : [];
        for(let note of this.notes){
            this.noteDirty.set(note.id, false);
        }
    }

    // 保存笔记
    saveNotes(){
        localStorage.setItem(this.noteStorageKey, JSON.stringify(this.notes));
    }

    // 更新笔记信息
    updateNoteInfo(){
        this.noteInfo.innerText = `共 ${this.noteContainer.childNodes.length - 1} 条笔记`;
    }

    // 创建笔记
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

    // 显示某个分类的全部笔记
    renderNotes(category){
        for(let note of this.noteDict.values()){
            note.parentNode.removeChild(note);
        }
        this.noteDict.clear();
        let notes = this.notes.filter(x => {
            // 搜索关键字
            if (this.searchKeyword !== ""){
                if (!x.title.toLowerCase().includes(this.searchKeyword) &&
                    !x.content.toLowerCase().includes(this.searchKeyword)) {
                    return false;
                }
            }
            // 由于 回收站 是一个特殊分类，全部分类要过滤掉 回收站
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

    // 显示单个笔记
    renderNote(note){
        var node = document.createElement("p");
        node.classList.add("note-item")
        node.draggable = true;
        node.innerText = note.title || "未命名笔记";
        node.onclick = () => {
            this.selectNote(note);
        }
        // 支持拖拽
        node.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('note', note.id);
        });
        // 如果是当前正在编辑的笔记，更新样式
        if (note.id === this.currentNote){
            node.classList.add("active");
            this.lastSelectedNote = node;
        }
        this.noteDict.set(note.id, node);
        this.noteContainer.appendChild(node);
    }

    // 选择分类
    selectCategory(id) {
        if (this.lastSelectedCategory != null){
            this.lastSelectedCategory.classList.remove("active");
        }
        this.lastSelectedCategory = this.categoryDict.get(id);
        this.lastSelectedCategory.classList.add("active");
        this.currentCategory = id;
        // 回收站不显示 创建笔记 按钮
        this.createNoteButton.style.display = (id === CATEGORY_DUSTBIN) ? "none" : "block";
        this.renderNotes(id);
    }

    // 删除分类
    deleteCategory(id) {
        const index = this.categories.findIndex(x => x.id === id);
        if (index !== -1) {
            this.categories.splice(index, 1);
            this.saveCategory();
            // 将分类下全部笔记移动至未分类
            for(let note of this.notes.filter(x => x.category === id)){
                note.category = CATEGORY_OTHER;
            }
            this.saveNotes();
            return true;
        }
        return false;
    }

    // 创建分类
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

    // 读取全部分类
    loadCategories(){
        const categoryJson = localStorage.getItem(this.categoryStorageKey);
        this.categories = categoryJson ? JSON.parse(categoryJson) : [];
        for(let category of this.categories){
            this.renderCategory(category);
        }
    }

    // 保存分类
    saveCategory(){
        localStorage.setItem(this.categoryStorageKey, JSON.stringify(this.categories));
    }

    // 显示分类
    renderCategory(category){
        var node = this.categoryTemplate.cloneNode(true);
        node.id = "";
        node.style.display = "flex";
        node.querySelector("span").innerText = category.title;
        // 编辑分类名称
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
        // 删除分类
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
        this.registerCategoryDragEvent(node, category.id);

        this.categoryDict.set(category.id, node);
        this.categorySpace.appendChild(node);
    }

    // 注册拖拽响应函数
    registerCategoryDragEvent(element, category){
        element.addEventListener('dragover', (event) => {
            event.preventDefault();  // 必须阻止默认行为才能触发drop事件
            element.classList.add('dragover');
        });

        element.addEventListener('dragleave', () => {
            element.classList.remove('dragover');
        });

        element.addEventListener('drop', (event) => {
            event.preventDefault();
            element.classList.remove('dragover');
            const note = Number(event.dataTransfer.getData('note'));
            this.dragCategoryHandler(note, category);
        });
    }

    // 拽托处理
    dragCategoryHandler(note, category){
        if (category === CATEGORY_DUSTBIN){
            msgBox.show("⚠ 确定要删除这条笔记？", "笔记将放置到回收站中，您稍后可以在回收站中找回。", (op) => {
                if (!op){
                    return;
                }
                noteManager.moveNoteCategory(note, CATEGORY_DUSTBIN);
                if (note === this.currentNote){
                    noteManager.selectNote(null);
                }
            }, "移至回收站", "我再想想");
        }else{
            const oldCategory = this.getNoteById(note).category;
            this.moveNoteCategory(note, category);
            if (note === this.currentNote && oldCategory === CATEGORY_DUSTBIN){
                noteManager.selectNote(null);
            }
        }
    }
}

var msgBox = new MessageBox(document.getElementById("msgbox"));
var inputBox = new InputBox(document.getElementById("inputbox"));

var searchInput = document.getElementById("note-search");

var noteManager = new NoteManager("myNote");

// 创建分类
function createCategory(){
    inputBox.show("请输入新分类的名称", (name) => {
        if (name == null || name === ""){
            return;
        }
        noteManager.createCategory(name);
        msgBox.show("分类创建成功", "可以将笔记移动至喜欢的分类。");
    }, "创建分类");
}

// 创建笔记
function createNote(){
    noteManager.createNote();
}

// 保存当前笔记
function saveCurrentNote(){
    noteManager.updateCurrentNote();
}

// 移动当前笔记到回收站
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

// 还原当前笔记
function moveOutCurrentNoteFromDustbin(){
    noteManager.checkCurrentNoteDirty(() => {
        noteManager.moveNoteCategory(noteManager.currentNote, CATEGORY_OTHER);
        noteManager.selectNote(null);
        msgBox.show("还原成功", "已将当前笔记移至未分类笔记。");
    });
}

// 真正地删除笔记
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
        }
        noteManager.noteDict.delete(noteManager.currentNote);
        noteManager.selectNote(null);
    }, "确定删除", "我再想想");
}

// 更新搜索
function updateSearchFilter(){
    noteManager.searchKeyword = searchInput.value.toLowerCase();
    noteManager.renderNotes(noteManager.currentCategory);
}
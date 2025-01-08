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

    show(title, callback = null, okBtn = "确定"){
        this.inputBox.value = "";

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
    lastSelectedCategory;

    constructor(storageKey) {
        this.categoryTemplate = document.getElementById("custom-category-template");
        this.categorySpace = document.getElementById("custom-category-space");

        this.categoryStorageKey = storageKey + "-category";
        this.noteStorageKey = storageKey + "-note";

        this.loadCategories();

        const specialCategories = ["all", "other", "dustbin"];
        for(let category of specialCategories){
            let node = document.getElementById("category-" + category);
            this.categoryDict.set(category, node);
            node.onclick = () => {
                this.selectCategory(category);
            }
        }
        this.selectCategory("all");
    }

    selectCategory(id) {
        if (this.lastSelectedCategory != null){
            this.lastSelectedCategory.classList.remove("active");
        }
        this.lastSelectedCategory = this.categoryDict.get(id);
        this.lastSelectedCategory.classList.add("active");
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
        node.querySelector(".delete-button").addEventListener("click", (event) => {
            event.stopPropagation();
            msgBox.show("⚠ 确认要删除这个分类？", "该分类下的笔记将移动至【未分类】，此操作不可逆！", (op) => {
                if (op){
                    if (this.lastSelectedCategory === node){
                        this.selectCategory("all");
                    }
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
        this.categorySpace.insertAdjacentElement('beforebegin', node);
    }
}

var msgBox = new MessageBox(document.getElementById("msgbox"));
var inputBox = new InputBox(document.getElementById("inputbox"));
var noneEditPanel = document.getElementById("none-edit-panel");
var editPanel = document.getElementById("edit-panel");

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
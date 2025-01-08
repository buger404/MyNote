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
    constructor() {
        this.categoryTemplate = document.getElementById("custom-category-template");

        for(var i = 0; i < 5; i++){
            this.renderCategory("测试分类" + i);
        }
    }

    renderCategory(title){
        var node = this.categoryTemplate.cloneNode(true);
        node.id = "";
        node.style.display = "flex";
        node.querySelector("span").innerText = title;
        this.categoryTemplate.insertAdjacentElement('afterend', node);
    }
}

var msgBox = new MessageBox(document.getElementById("msgbox"));
var inputBox = new InputBox(document.getElementById("inputbox"));
var noneEditPanel = document.getElementById("none-edit-panel");
var editPanel = document.getElementById("edit-panel");

var noteManager = new NoteManager();

function deleteNote(event){
    event.stopPropagation();
    msgBox.show("⚠ 确认要删除这条笔记？", "此操作不可逆！", (op) => {
        msgBox.show("你选择了", op);
    }, "确定删除", "我再想想");
}

function createCategory(){
    inputBox.show("请输入新分类的名称", (name) => {
        msgBox.show("你输入了", name);
    }, "创建分类");
}
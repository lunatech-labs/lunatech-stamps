function Expression(expr){
	this.expr = expr;
}

function Code(code){
	this.code = code;
}

function Tag(name){
	this.name = name;
	this.children = [];
}

Tag.prototype = {
	addChild: function(child){
		this.children.push(child);
	}
};

var currentTag = new Tag('main');

function processTemplates(){
 var node = document.documentElement;
 processNode(node);
}

function processNode(node){
 switch(node.nodeType){
  case Node.ELEMENT_NODE:
   //console.log('element: '+node.nodeName);
   var nodes = node.childNodes;
   for(var i=0;i<nodes.length;i++){
    var child = nodes.item(i);
    processNode(child); 
   }
   break;
  case Node.TEXT_NODE:
   processTextNode(node);
   break;
 }
}

function processTextNode(node){
	var text = node.nodeValue;
	//console.log('text: '+text);
	var openCode = undefined;
	var openExpr = undefined;
	var openTag = undefined;
	var lastText = 0;
	for(var i=0;i<text.length;i++){
		var c = text[i];
		var hasMore = i<text.length-1;
		var c2 = hasMore ? text[i+1] : undefined;
		// Code block
		if(c === '5' && c2 === '{'){
			// collect text leading to this
			currentTag.addChild(text.substring(lastText, i));
			i++;
			openCode = i+1;
		}else if(openCode !== undefined && c === '}' && c2 === '5'){
			var code = text.substring(openCode, i);
			console.log('Got code: '+code);
			currentTag.addChild(new Code(code));
			// move past the '}' to the '5'
			i++;
			// start collecting text after the '5'
			lastText = i+1;
			openCode = undefined;
		}
		// Expression block
		else if(c === '4' && c2 === '{'){
			// collect text leading to this
			currentTag.addChild(text.substring(lastText, i));
			i++;
			openExpr = i+1;
		}else if(openExpr !== undefined && c === '}'){
			var expr = text.substring(openExpr, i);
			console.log('Got expr: '+expr);
			currentTag.addChild(new Expression(expr));
			// start collecting text after the '}'
			lastText = i+1;
			openExpr = undefined;
		}
		// Tag block
		else if(c === '3' && c2 === '{'){
			// collect text leading to this
			currentTag.addChild(text.substring(lastText, i));
			i++;
			openTag = i+1;
		}else if(openTag !== undefined && c === '}'){
			var tag = text.substring(openTag, i);
			console.log('Got tag: '+tag);
			var newTag = parseTag(tag);
			if(newTag.isEnd){
				// we are closing the current tag
				if(newTag.name != currentTag.name)
					throw "Invalid end tag "+newTag.name+" for current tag "+currentTag.name;
				currentTag = currentTag.parent;
			}else{
				currentTag.addChild(newTag);
				newTag.parent = currentTag;
				if(!newTag.isClosed){
					// this is the start of a new tag, let's dig in
					currentTag = newTag;
				}
			}
			// start collecting text after the '}'
			lastText = i+1;
			openTag = undefined;
		}
	}
	if(lastText < text.length)
		currentTag.addChild(text.substring(lastText));
}

function parseTag(tag){
	if(tag[0] == '/'){
		var name = tag.match(/^\/([a-zA-Z0-9]+)\s*$/)[1];
		console.log('tag close for '+name);
		var ret = new Tag(name);
		ret.isEnd = true;
		return ret;
	}
	var name = tag.match(/^([a-zA-Z0-9]+)[ \/]/)[1];
	console.log('tag name: '+name);
	tag = tag.substring(name.length);
	var isOpen = !tag.match(/\/$/);
	if(!isOpen)
		tag = tag.substring(0, tag.length-1);
	var attributes = {};
	var openStack = [];
	var attribute = undefined;
	var valueStart = undefined;
	var start = 0;
	for(var i = 0;i<tag.length;i++){
		var c = tag[i];
		if(openStack.length == 0 && c == ':'){
			attribute = tag.substring(start, i).trim();
			valueStart = i+1;
		}else if(openStack.length == 0 && c == ','){
			if(!valueStart)
				throw "Invalid syntax: attribute name missing: "+tag;
			// we are done!
			attributes[attribute] = tag.substring(valueStart, i);
			valueStart = undefined;
			start = i+1;
		}else if(c == '('){
			openStack.push(')');
		}else if(c == '{'){
			openStack.push('}');
		}else if(c == '['){
			openStack.push(']');
		}else if(c == ')' || c == ']' || c == '}'){
			var closed = openStack.pop();
			if(!closed)
				throw "Mismatched parent: unexpected "+c;
			if(closed != c)
				throw "Mismatched parent: unexpected "+c+" expecting: "+closed;
			// all is well
		}
	}
	if(valueStart){
		// we still have some value left?
		var value = tag.substring(valueStart);
		if(openStack.length != 0)
			throw "Mismatched parent: forgot to close "+openStack.length+" parents";
		attributes[attribute] = value;
	}
	//console.log(attributes);
	var ret = new Tag(name);
	ret.isOpen = isOpen;
	ret.attributes = attributes;
	return ret;
}

var ecount = 0;

function evaler(){
	var e = ecount++;
	this.eval = function(___expr){
		console.log('Evaluating in context '+e);
		return eval(___expr);
	};
}

evaler.prototype = {
};

jQuery(processTemplates);

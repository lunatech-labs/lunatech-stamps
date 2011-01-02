function Expression(expr){
	this.expr = expr;
}

Expression.prototype = {
	output: function(out){
		// we're outputing the result of this expression
		out(evalInEnv(this.expr, env));
	}
};

function Code(code){
	this.code = code;
}

Code.prototype = {
	output: function(out){
		// extend the environment
		env = env(this.code);
	}
};

var env = eval(extendEnv("42"));

function Tag(name, attributes){
	this.name = name;
	this.children = [];
	this.attributes = attributes;
}

Tag.prototype = {
	addChild: function(child){
		this.children.push(child);
	},
	output: function(out, previousSibling){
		// preserve environment
		var parentEnv = env;
		if(this.name == 'list'){
			var l = evalInEnv(this.attributes.items, env);
			var v = evalInEnv(this.attributes['var'], env);
			for(var i = 0 ; i < l.length ; i++){
				env = env(v+' = '+l[i]+';');
				this.recursiveOutput(out);
			}
		}else if(this.name == 'if'){
			this.testMatched = evalInEnv(this.attributes._arg, env);
			console.log("if "+this.attributes._arg+" yielded "+this.testMatched);
			if(this.testMatched)
				this.recursiveOutput(out);
		}else if(this.name == 'else'){
			if(typeof previousSibling != 'Tag' && previousSibling.name != 'if')
				throw "Invalid else: missing if";
			if(!previousSibling.testMatched)
				this.recursiveOutput(out);
		}else
			this.recursiveOutput(out);
		// restore the environment
		env = parentEnv;
	},
	recursiveOutput: function(out){
		var lastChild;
		for(var i=0;i<this.children.length;i++){
			var child = this.children[i];
			if(typeof child == 'string'){
				out(child);
				if(child.trim().length > 0)
					lastChild = child;
			}else{
				child.output(out, lastChild);
				lastChild = child;
			}
		}
	}
};

var currentTag = new Tag('main');

function loadTemplate(id, url){
	jQuery.ajax({
		method: 'GET',
		url: url,
		success: function(data){
			processTemplates(id, data);
		},
		error: function(ouch){
			alert(ouch);
		}
	});
}

function processTemplates(id, text){
	parseTemplates(text);
	if(currentTag.name != 'main')
		throw "Bad current tag after parsing";
	var data = '';
	currentTag.output(function(part){
		console.log('outputing '+part);
		data += part;
	});
	jQuery('#'+id).html(data);
}

function parseTemplates(text){
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
	var name = tag.match(/^([a-zA-Z0-9]+)[ \/]?/)[1];
	console.log('tag name: '+name);
	tag = tag.substring(name.length).trim();
	var isOpen = !tag.match(/\/$/);
	if(!isOpen)
		tag = tag.substring(0, tag.length-1);
	var attributes = {};
	var openStack = [];
	var hasAttribute = false;
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
			attributes[attribute] = tag.substring(valueStart, i).trim();
			hasAttribute = true;
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
		// safety check
		if(openStack.length != 0)
			throw "Mismatched parent: forgot to close "+openStack.length+" parents";
		// we still have some value left?
		var value = tag.substring(valueStart).trim();
		attributes[attribute] = value;
	}else if(tag.length > 0 && !hasAttribute){
		// safety check
		if(openStack.length != 0)
			throw "Mismatched parent: forgot to close "+openStack.length+" parents";
		// we have no attributes and some content: it's the implicit argument
		attributes._arg = tag;
	}
	//console.log(attributes);
	var ret = new Tag(name, attributes);
	ret.isOpen = isOpen;
	return ret;
}

function extendEnv(e){ 
	return "(function(){ "+e+"; return function(e){ return eval(extendEnv(e)); }})()"; 
}

var result;

function evalInEnv(expr, env){
	env("result = "+expr);
	return result;
}



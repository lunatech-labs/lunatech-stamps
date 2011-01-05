var JSTemplates = {};

// this is a private scope
(function(){

//
// Our Type extension mechanism

function extend(SubType, ParentType){
	var constructor = SubType.constructor;
	if(Object.create){
		SubType.prototype = Object.create(ParentType.prototype);
	}else{
		function SubPrototype(){};
		SubPrototype.prototype = ParentType.prototype;
		SubType.prototype = new SubPrototype();
	}
	SubType.prototype.constructor = constructor;
}

//
// Code and expression types

function Expression(expr){
	this.expr = expr;
}

Expression.prototype.output = function(out, previousSibling, env){
	// we're outputing the result of this expression
	out(env.evalExpression(this.expr));
};

function Code(code){
	this.code = code;
}

Code.prototype.output = function(out, previousSibling, env){
	// extend the environment
	env.evalStatement(this.code);
};

//
// Our pluggable Tag system

var declaredTags = {};

var declareTag = JSTemplates.declareTag = function(name, constructor){
	declaredTags[name] = constructor;
}

function makeTag(name, attributes){
	var constructor = declaredTags[name] || Tag;
	return new constructor(name, attributes);
}

// the initial list
declareTag('if', IfTag);
declareTag('else', ElseTag);
declareTag('list', ListTag);

//
// Our base Tag type

var Tag = JSTemplates.Tag = function(name, attributes){
	this.name = name;
	this.children = [];
	this.attributes = attributes;
}

Tag.prototype.addChild = function(child){
	this.children.push(child);
};

Tag.prototype.output = function(out, previousSibling, env){
	// preserve environment
	env.preserve();
	this.outputInNewEnv(out, previousSibling, env);
	// restore the environment
	env.restore();
};

Tag.prototype.outputInNewEnv = function(out, previousSibling, env){
	this.recursiveOutput(out, env);
};

Tag.prototype.recursiveOutput = function(out, env){
	var lastChild;
	for(var i=0;i<this.children.length;i++){
		var child = this.children[i];
		if(typeof child == 'string'){
			out(child);
			if(child.trim().length > 0)
				lastChild = child;
		}else{
			child.output(out, lastChild, env);
			lastChild = child;
		}
	}
};

//
// The list tag

var gensymCounter = 0;

function gensym(){
	return '__jstemplates_' + gensymCounter++;
}

function ListTag(name, attributes){
	Tag.apply(this, [name, attributes]);
}
extend(ListTag, Tag);

ListTag.prototype.outputInNewEnv = function(out, previousSibling, env){
	var l;
	if(this.resumingFromFuture){
		l = this.resumingFromFuture;
	}else{
		l = env.evalExpression(this.attributes.items);
	}
	if(l instanceof Future){
		var data = l.getData();
		if(data){
			// we already have the data, good
			this.outputList(out, env, data);
		}else{
			// we need to delay evaluation
			var substId = gensym();
			var clonedEnv = env.clone();
			var tag = this;
			l.listen(function(data){
				// resume templates at that point
				var target = jQuery("#"+substId);
				target.removeClass("jstemplates-waiter");
				tag.resumingFromFuture = data;
				evalTemplate(tag, clonedEnv, target);
			});
			out("<span class='jstemplates-waiter' id='"+substId+"'>Loading...</span>");
		}
	}else
		this.outputList(out, env, l);
};

ListTag.prototype.outputList = function(out, env, l){
	var v = env.evalExpression(this.attributes['var']);
	var vList = v+"_list";
	var vIndex = v+"_index";
	env.evalStatement("var "+vList+', '+vIndex+", "+v);
	env.setVariable(vList, l);
	for(var i = 0 ; i < l.length ; i++){
		env.setVariable(vIndex, i);
		env.setVariable(v, l[i]);
		this.recursiveOutput(out, env);
	}
};

//
// The if tag

function IfTag(name, attributes){
	Tag.apply(this, [name, attributes]);
}
extend(IfTag, Tag);

IfTag.prototype.outputInNewEnv = function(out, previousSibling, env){
	this.testMatched = env.evalExpression(this.attributes._arg);
	console.log("if "+this.attributes._arg+" yielded "+this.testMatched);
	if(this.testMatched)
		this.recursiveOutput(out, env);
};

//
// The else tag

function ElseTag(name, attributes){
	Tag.apply(this, [name, attributes]);
}
extend(ElseTag, Tag);

ElseTag.prototype.outputInNewEnv = function(out, previousSibling, env){
	if(!(previousSibling instanceof IfTag))
		throw "Invalid else: missing if";
	if(!previousSibling.testMatched)
		this.recursiveOutput(out, env);
};

//
// Functions

// Procedural API
JSTemplates.loadTemplate = function loadTemplate(id, url){
	loadTemplateFromURL(jQuery('#'+id), url);
}

// jQuery plugin
jQuery.fn.jsTemplates = function(url){
	var target = this;
	loadTemplateFromURL(target, url);
}

// data-template="url" support
jQuery(function(){
	jQuery("[data-template]").each(function(index, elem){
		var $elem = jQuery(elem);
		var url = $elem.attr('data-template');
		loadTemplateFromURL($elem, url);
	});
});

// data-istemplate="inline" support
jQuery(function(){
	jQuery("[data-jstemplate]").each(function(index, elem){
		var $elem = jQuery(elem);
		var data = jQuery('script[type=text/html]', $elem).html();
		console.log('data is '+data);
		processTemplates($elem, data);
	});
});

function loadTemplateFromURL(target, url){
	jQuery.ajax({
		method: 'GET',
		url: url,
		success: function(data){
			processTemplates(target, data);
		},
		error: function(ouch){
			alert(ouch);
		}
	});
}

function processTemplates($target, text){
	// this is in there to capture an env where currentTag is defined
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
			if(c === '!' && c2 === '{'){
				// collect text leading to this
				currentTag.addChild(text.substring(lastText, i));
				i++;
				openCode = i+1;
			}else if(openCode !== undefined && c === '}' && c2 === '!'){
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
			else if(c === '^' && c2 === '{'){
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
			else if(c === '~' && c2 === '{'){
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

	// start with a tag
	var currentTag = new Tag('main');
	parseTemplates(text);
	// sanity check
	if(currentTag.name != 'main')
		throw "Bad current tag after parsing";
	// now output
	evalTemplate(currentTag, new Environment(), $target);
}

function evalTemplate(tag, env, $target){
	var data = '';
	tag.output(function(part){
		console.log('outputing '+part);
		data += part;
	}, null, env);
	// and replate
	$target.html(data);
}

function parseTag(tag){
	if(tag[0] == '/'){
		var name = tag.match(/^\/([a-zA-Z0-9]+)\s*$/)[1];
		console.log('tag close for '+name);
		var ret = makeTag(name);
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
	var ret = makeTag(name, attributes);
	ret.isOpen = isOpen;
	return ret;
}

//
// Environment magic

function Environment(){
	this.env = eval(extendEnv("42"));
	this.savedEnvironments = [];
}

Environment.prototype.preserve = function(){
	this.savedEnvironments.push(this.env);
}

Environment.prototype.clone = function(){
	var clone = new Environment();
	clone.env = this.env;
	clone.savedEnvironments = this.savedEnvironments.concat(); // copy list
	return clone;
}

Environment.prototype.restore = function(){
	this.env = this.savedEnvironments.pop();
}

Environment.prototype.evalStatement = function(stmt){
	this.env = this.env(stmt);
}

Environment.prototype.evalExpression = function(e){
	return this.env(e, true);
}

Environment.prototype.setVariable = function(v, e){
	this.env(e, v)(e);
}

function extendEnv(e, isExpr){
	var body;
	if(isExpr === true)
		body = "return ("+e+");";
	else if(isExpr)
		body = "return function(e){ "+isExpr+" = e;};";
	else
		body = e+"; return function(e, isExpr){ return eval(extendEnv(e, isExpr)); }";
	console.log("Eval: "+body);
	return "(function(){ "+body+" })()"; 
}

//
// The Futures API

function Future(url){
	var future = this;
	jQuery.ajax({
		method: 'GET',
		url: url,
		success: function(data){
			future.dataReady(data);
		},
		error: function(ouch){
			alert(ouch);
		}
	});
}

// make it public
JSTemplates.Future = Future;

Future.prototype.dataReady = function(data){
	// do we already have a receiver ?
	if(this.receiver)
		this.receiver(data);
	else // store it for later
		this.data = data;
}

Future.prototype.getData = function(receiver){
	return this.data;
}

Future.prototype.listen = function(receiver){
	this.receiver = receiver;
}

// end private scope
})();
var JSTemplates = {};

/*
 * TODO:
 * 
 * - Figure out if scopes should be lexical and/or dynamic
 * - Make Future its own tag and get it out of the list tag
 */

// this is a private scope
(function(){

//
// Our gensym

var gensymCounter = 0;

function gensym(){
	return '__jstemplates_' + gensymCounter++;
}

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
// make it public
JSTemplates.extend = extend;

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
// References

var references = JSTemplates.references = {};

JSTemplates.getReference = function (name){
	return references[name];
}

function Reference(ref){
	this.ref = ref;
}

Reference.prototype.output = function(out, previousSibling, env){
	// eval the string
	var val = env.evalExpression(this.ref);
	// now remember it for later somewhere
	var refName = gensym();
	references[refName] = val;
	// and output code that can get to it
	out("JSTemplates.getReference('"+refName+"')");
};

//
// Our pluggable Tag system

var declaredTags = {};

var declareTag = JSTemplates.declareTag = function(name, constructor){
	declaredTags[name] = constructor;
}

function makeTag(name, attributes){
	var constructor = declaredTags[name];
	if(!constructor)
		throw "Unknown tag: " + name;
	return new constructor(name, attributes);
}

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
				var html = evalTemplate(tag, clonedEnv);
				target.replaceWith(html);
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
// The doBody tag

function DoBodyTag(name, attributes){
	Tag.apply(this, [name, attributes]);
}
extend(DoBodyTag, Tag);

DoBodyTag.prototype.outputInNewEnv = function(out, previousSibling, env){
	// we must obtain the body of the current tag's invocation
	var body = env.getContext('body');
	if(!body)
		throw "Invalid doBody tag: not invoked via simple tag";
	// and invoke it as if it were located here
	body.recursiveOutput(out, env);
};

// 
// Declare the initial list of tags
declareTag('if', IfTag);
declareTag('else', ElseTag);
declareTag('list', ListTag);
declareTag('doBody', DoBodyTag);

//
// Our cached templates

var templates = {};

//
// Functions

// Procedural API
JSTemplates.loadTemplate = function loadTemplate(id, params, env){
	jQuery('#'+id).jsTemplates(params, env);
}

// jQuery plugin
jQuery.fn.jsTemplates = function(params, env){
	var target = this;
	if(params.url)
		loadTemplateFromURL(target, params.url, env);
	else if(params.id){
		var template = templates[params.id];
		if(!template)
			throw "Invalid template id: "+params.id;
		var html = evalTemplate(template, new Environment(env));
		target.html(html);
	}else
		throw "Invalid or missing argument, expecting id or url";
}

// magic processing
jQuery(function(){
	// we fist want to load all user tags
	// data-jstemplate="tag" support
	jQuery("[data-jstemplate=tag]").each(function(index, elem){
		var $elem = jQuery(elem);
		var name = $elem.attr('name');
		if(!name)
			throw "Missing name on template tag";
		var data = $elem.html();
		var tag = parseTemplates(data);
		console.log("Defining new tag: "+tag);

		// make a new type, hehe
		function UserTag(name, attributes){
			// do like Play! and prepend '_' to attributes
			var newAttributes = {};
			for(var attribute in attributes){
				var newAttribute;
				if(!attribute.match(/^_/))
					newAttribute = "_" + attribute;
				else
					newAttribute = attribute;
				newAttributes[newAttribute] = attributes[attribute];
			}
			Tag.apply(this, [name, newAttributes]);
		}
		extend(UserTag, Tag);

		UserTag.prototype.outputInNewEnv = function(out, previousSibling, env){
			// we start by defining the variables passed to us
			for(var attribute in this.attributes){
				this.attributes[attribute] = env.evalExpression(this.attributes[attribute]);
			}
			env.declareVariables(this.attributes);
			// then we let the 'doBody' tag know that we hold the body
			env.pushContext('body', this);
			// now proceed with the tag body
			tag.output(out, undefined, env);
			// and pop the context
			env.popContext('body');
		};

		declareTag(name, UserTag);
	});

	// then define new templates by reference
	// data-jstemplate="ref" support
	jQuery("[data-jstemplate=ref]").each(function(index, elem){
		var $elem = jQuery(elem);
		var id = $elem.attr('id');
		if(!id)
			throw "Missing ID on template reference";
		var data = $elem.html();
		templates[id] = parseTemplates(data);
	});
	
	// and then process the templates
	
	// data-template="url" support
	jQuery("[data-jstemplate-url]").each(function(index, elem){
		var $elem = jQuery(elem);
		var url = $elem.attr('data-jstemplate-url');
		loadTemplateFromURL($elem, url);
	});

	// data-jstemplate="inline" support
	jQuery("[data-jstemplate=inline]").each(function(index, elem){
		var $elem = jQuery(elem);
		var data = $elem.html();
		var html = processTemplates(data);
		$elem.replaceWith(html);
	});
});

function loadTemplateFromURL(target, url, env){
	jQuery.ajax({
		method: 'GET',
		url: url,
		success: function(data){
			var html = processTemplates(data, env);
			target.html(html);
		},
		error: function(ouch){
			alert(ouch);
		}
	});
}

function processTemplates(text, env){
	var tag = parseTemplates(text);
	// now output
	return evalTemplate(tag, new Environment(env));
}

function parseTemplates(text){
	// start with a tag
	var currentTag = new Tag('main');

	//console.log('text: '+text);
	var openCode = undefined;
	var openExpr = undefined;
	var openTag = undefined;
	var openRef = undefined;
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
		// Reference block
		else if(c === '`' && c2 === '{'){
			// collect text leading to this
			currentTag.addChild(text.substring(lastText, i));
			i++;
			openRef = i+1;
		}else if(openRef !== undefined && c === '}'){
			var ref = text.substring(openRef, i);
			console.log('Got ref: '+ref);
			currentTag.addChild(new Reference(ref));
			// start collecting text after the '}'
			lastText = i+1;
			openRef = undefined;
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
				if(newTag.isOpen){
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
	// sanity check
	if(currentTag.name != 'main')
		throw "Bad current tag after parsing";
	return currentTag;
}

function evalTemplate(tag, env, $target, replace){
	var data = '';
	tag.output(function(part){
		console.log('outputing '+part);
		data += part;
	}, null, env);
	return data;
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

function Environment(initialValues){
	this.env = eval(extendEnv("42"));
	this.context = {};
	if(initialValues){
		this.declareVariables(initialValues);
	}
}

Environment.prototype.declareVariables = function(initialValues){
	var decl = "var "; 
	for(var name in initialValues){
		if(decl.length > 4)
			decl += ", ";
		decl += name;
	}
	decl += ";";
	this.evalStatement(decl);
	for(var name in initialValues){
		this.setVariable(name, initialValues[name]);
	}		
}

Environment.prototype.pushContext = function(contextName, value){
	if(!this.context[contextName])
		this.context[contextName] = [];
	this.context[contextName].push(value);
}

Environment.prototype.popContext = function(contextName){
	var ctx = this.context[contextName];
	if(!ctx)
		throw "No such context: "+contextName;
	return ctx.pop();
}

Environment.prototype.getContext = function(contextName){
	var ctx = this.context[contextName];
	if(!ctx)
		throw "No such context: "+contextName;
	return ctx[ctx.length-1];
}

Environment.prototype.preserve = function(){
	this.pushContext('environment', this.env);
}

Environment.prototype.restore = function(){
	this.env = this.popContext('environment');
}

Environment.prototype.clone = function(){
	var clone = new Environment();
	clone.env = this.env;
	// deep copy the context
	clone.context = {};
	for(var contextName in this.context){
		clone.context[contextName] = this.context[contextName].concat(); // copy list
	}
	return clone;
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
	else if(isExpr) // this means we want to inject a value in a variable
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
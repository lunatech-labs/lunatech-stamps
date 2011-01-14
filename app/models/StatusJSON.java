package models;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.Entity;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Transient;

import play.db.jpa.Model;
import play.mvc.Router;
import controllers.Application;

public class StatusJSON {
	
	public String text;
	public Author author;
	public Date date;
	public Long id;
	public List<CommentJSON> comments = new ArrayList<CommentJSON>();
	public List<AtomLink> links = new ArrayList<AtomLink>();
	
	public StatusJSON(Status src){
		this.author = src.author;
		this.text = src.text;
		this.date = src.date;
		this.id = src.id;
		for(Comment comment : src.comments)
			comments.add(new CommentJSON(comment));
		setupAtomLinks();
	}
	
	private void setupAtomLinks(){
		Map<String, Object> idMap = new HashMap<String, Object>();
		idMap.put("id", id);
		links.add(new AtomLink("add-comment", Router.getFullUrl("Application.addComment", idMap)));
		if(author.email.equals(Application.STEF)){
			links.add(new AtomLink("remove", Router.getFullUrl("Application.deleteStatus", idMap)));
		}
	}
}

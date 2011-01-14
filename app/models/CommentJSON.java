package models;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.Entity;
import javax.persistence.ManyToMany;
import javax.persistence.ManyToOne;
import javax.persistence.Transient;

import controllers.Application;

import play.db.jpa.Model;
import play.mvc.Router;

public class CommentJSON {
	public Author author;
	public String text;
	public Date date;
	public List<AtomLink> links = new ArrayList<AtomLink>();
	public Long id;

	public CommentJSON(Comment src) {
		this.author = src.author;
		this.text = src.text;
		this.date = src.date;
		this.id = src.id;
		setupAtomLinks();
	}
	
	private void setupAtomLinks(){
		if(author.email.equals(Application.STEF)){
			Map<String, Object> idMap = new HashMap<String, Object>();
			idMap.put("id", id);
			links.add(new AtomLink("remove", Router.getFullUrl("Application.deleteComment", idMap)));
		}
	}

}

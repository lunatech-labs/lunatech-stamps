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

@Entity
public class Comment extends Model{
	@ManyToOne
	public Author author;
	public String text;
	
	@ManyToOne
	public Status status;
	
	public Date date;

	@Transient
	public List<AtomLink> links = new ArrayList<AtomLink>();

	public Comment(Author author, String text) {
		this.author = author;
		this.text = text;
		this.date = new Date();
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

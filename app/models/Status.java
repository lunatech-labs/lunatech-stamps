package models;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.CascadeType;
import javax.persistence.Entity;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Transient;

import play.db.jpa.Model;
import play.mvc.Router;
import controllers.Application;

@Entity
public class Status extends Model {
	
	public String text;
	@ManyToOne
	public Author author;
	public Date date;
	@OneToMany(mappedBy = "status", cascade = CascadeType.REMOVE)
	public List<Comment> comments = new ArrayList<Comment>();

	@Transient
	public List<AtomLink> links = new ArrayList<AtomLink>();
	
	public Status(Author author, String text){
		this.author = author;
		this.text = text;
		this.date = new Date();
		setupAtomLinks();
	}
	
	private void setupAtomLinks(){
		if(author.email.equals(Application.STEF)){
			Map<String, Object> idMap = new HashMap<String, Object>();
			idMap.put("id", id);
			links.add(new AtomLink("remove", Router.getFullUrl("Application.deleteStatus", idMap)));
			links.add(new AtomLink("add-comment", Router.getFullUrl("Application.addComment", idMap)));
		}
	}
}

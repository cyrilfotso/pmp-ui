import { Component, OnInit } from '@angular/core';
import {message} from '../models/message';
import {action} from '../models/action';
import {event} from '../models/event';
import {ChatService} from '../services/chat.service';
import {IssuetrackerService as userserv} from '../services/issuetracker.service';
import { ToastrService } from 'ngx-toastr';
import {NgbModal, ModalDismissReasons} from '@ng-bootstrap/ng-bootstrap';
import { ScrollToService, ScrollToConfigOptions } from '@nicky-lenaers/ngx-scroll-to';
import {AuthService} from '../services/auth.service'
import { embeddedViewEnd } from '@angular/core/src/render3';
import { MomentModule } from 'angular2-moment';



@Component({
  selector: 'app-chats',
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.scss']
})
export class ChatsComponent implements OnInit {

  action = action;
  messageContent: string;
  ioConnection: any;

  list_messages = [];
  selected_group = {};
  new_dm_user_select='';
  new_gm_user_select = ''
  new_gm_name = '';
  closeResult: string;
  employee_list=[];
  room_display = {};
  current_emp_id : any;
  current_room_id : number;
  text_message='';
  current_room_name='';

  constructor(private _auth: AuthService, private modalService: NgbModal, private chatserv: ChatService, private userserv: userserv, private toast: ToastrService, private _scrollToService: ScrollToService) { }

  ngOnInit() {
    // init the globals arrays of list
    this.userserv.listEmployee().subscribe(data => {
      this.employee_list = data['employees']
    });
    
    this.chatserv.listMessages().subscribe(data=> {
      this.list_messages = data['data'];
      // hide all the div for each chat room
      this.setVisible(null);
    });

    // init the sockets connexions
    this.initIoConnection();
    // scroll to the botom
    // this.triggerScrollTo();
    this.current_emp_id = this._auth.getUserEmployeeId;
  }

  private initIoConnection(): void {
    this.chatserv.initSocket();
    this.ioConnection = this.chatserv.onMessage()
      .subscribe((message: any) => {
        // console.log('message', message);
        // find the room and push the new message in the message array
        console.log('finding the corresponding room');

        this.list_messages.filter(room => room['room_id']==message['chatroom_id'])[0]['room_messages'].push(message);
        // notify others that a new message is arrived in a room
        if(this.current_emp_id != message['employee_id']){
          var roommsg= this.list_messages.filter(room => room['room_id']==message['chatroom_id'])[0]
          if (roommsg['room_type'] == 'DM'){
            var msg = 'New DM Message from '+message['employee_name'];
          }else{
            var msg = 'New Message From '+message['employee_name']+' in '+roommsg['room_name'];
          }
          this.toast.info('Info', msg, {
            closeButton: true
          });
        }
        // scroll down to have the new messages always on screen   
        this.triggerScrollTo('room_'+message['chatroom_id']);
    });

    this.ioConnection = this.chatserv.onStatus()
      .subscribe((message: any) => {
        console.log('status', message);
    });

    this.chatserv.onEvent(event.CONNECT)
      .subscribe(() => {
        console.log('connected');
        // subscribe to your chat rooms
        this.list_messages.forEach(element => {
          var join_data = {
            name: this._auth.getusername,
            room: element.room_name
           }
          this.chatserv.post_in_room('joined', join_data);
        });
      });

    this.chatserv.onEvent(event.DISCONNECT)
      .subscribe(() => {
        console.log('disconnected');
        // unsubscribe to your chat rooms
        this.list_messages.forEach(element => {
          var join_data = {
            name: this._auth.getusername,
            room: element.room_name
           }
          this.chatserv.post_in_room('left', join_data);
        });
      });
  }


  public setVisible(room_id:number, room_name?:string):void{
    if (room_id == null){
      this.list_messages.forEach(element => {
        this.room_display[element.room_id] = false;
      });
      this.current_room_name ='';
    }else{
      this.list_messages.forEach(element => {
        if(room_id == element.room_id){
          this.room_display[element.room_id] = true; 
          this.current_room_name = ' >>> '+room_name;
        }else{
          this.room_display[element.room_id] = false;
        }
      });
      this.triggerScrollTo('room_'+String(room_id));
    }
  }

  public sendMessage(message: string): void {
    if (!message) {
      return;
    }
    this.chatserv.send({
      from: 'user',
      content: message
    });
    this.messageContent = null;
  }

  public sendNotification(params: any, action: string): void {
    let message: message;
    if (action === 'JOINED') {
      message = {
        from: 'user',
        action: action
      }
    } else if (action === 'RENAME') {
      message = {
        action: action,
        content: {
          username: 'this.user.name',
          previousUsername: params.previousUsername
        }
      };
    }else if (action === 'LEFT') {
      message = {
        from: 'user',
        action: action
      }
    }
    this.chatserv.send(message);
  }
  
  public triggerScrollTo(div_id:String) {
    const config: ScrollToConfigOptions = {
      target: String(div_id)
    };
    this._scrollToService.scrollTo(config);
    // console.log('je scrolle', div_id);
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return  `with: ${reason}`;
    }
  }
  
  open_modal(content) {    
    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title'}).result.then((result) => {
      this.closeResult = `Closed with: ${result}`;
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  open_modal_add_user(content, item_id, item_name) {  
    this.selected_group['id'] =  item_id;
    this.selected_group['name'] =  item_name;  
    this.modalService.open(content, {ariaLabelledBy: 'modal-basic-title'}).result.then((result) => {
      this.closeResult = `Closed with: ${result}`;
    }, (reason) => {
      this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
    });
  }

  start_new_dm(modal){
    if(this.new_dm_user_select.length < 3){
      return;
    }
    console.log(JSON.parse(this.new_dm_user_select)['id'], 'new dm');
    // find if we already have that user in dm
    var emp = {
      employee_id: JSON.parse(this.new_dm_user_select)['id'],
      employee_name: JSON.parse(this.new_dm_user_select)['name']
    };
    var user_found = this.list_messages.filter(room => ((room.room_type=='DM') &&  ((room.room_users.filter(usr => usr.employee_id==emp.employee_id)).length>0)  ) )
    console.log("user found ? ", user_found);
    if(user_found.length>0){
      modal.dismiss('Submitting the form');
      this.toast.warning('Warning',  'You already have DM with '+emp.employee_name, {
        closeButton: true
      });
      return;
    }else{
      // first create the new room then add those two employee to it
      this.chatserv.createNewRoom('DM_'+emp.employee_name+'_'+String(this.current_emp_id), 'DM').subscribe(
        data =>{
          var id_room = data['id'];
            this.chatserv.addEmployeeToRoom(id_room, this.current_emp_id).subscribe(
              data=>{
                this.chatserv.addEmployeeToRoom(id_room, emp.employee_id).subscribe(
                  data=>{
                    this.toast.success('Success',  'New DM with Created With '+emp.employee_name, {
                      closeButton: true
                    });
                    // reset all the variables to fetch everything
                    this.chatserv.listMessages().subscribe(data=> {
                      this.list_messages = data['data'];
                      this.setVisible(null);
                    });                
                    // init the sockets connexions
                    this.initIoConnection();
                  },
                  erro =>{ console.log('fail to add the second employee'); }
                );
              },
              erro =>{console.log('fail to add the first employee');}
            );
        },
        error =>{ console.log('fail to create the private dm room'); }
      );
      modal.dismiss('Submitting the form');      
    }
    
  }

  start_new_gm(modal){
    if(this.new_gm_name.length < 3){
      return;
    }
    console.log(this.new_gm_name);
    this.chatserv.createNewRoom(this.new_gm_name, 'GM').subscribe(
      data => {
        var id_room = data['id'];
        this.chatserv.addEmployeeToRoom(id_room, this.current_emp_id).subscribe(
          data => {
            this.toast.success('Success',  'New Group Message Created', {
              closeButton: true
            });
            // reset all the variables to fetch everything
            this.chatserv.listMessages().subscribe(data=> {
              this.list_messages = data['data'];
              this.setVisible(null);
            });                
            // init the sockets connexions
            this.initIoConnection();
            this.new_gm_name='';
            modal.dismiss('Submitting the form'); 
          },
          error => {console.log('fail to add the you to the room');}
        );
      },
      error => {console.log('fail to create the group chat room');}
    );
  }

  add_user_to_gm(modal){
    if(this.new_gm_user_select.length < 3){
      return;
    }    
    var user = JSON.parse(this.new_gm_user_select);
    // var group = JSON.parse(String(this.selected_group));
    console.log(user, this.selected_group['id'], this.selected_group['name']);
    this.chatserv.addEmployeeToRoom(this.selected_group['id'], user.id).subscribe(
      data => {
        this.toast.success('Success',  'User well added to the group message', {
          closeButton: true
        });
        // reset all the variables to fetch everything
        this.chatserv.listMessages().subscribe(data=> {
          this.list_messages = data['data'];
          this.setVisible(null);
        });                
        // init the sockets connexions
        this.initIoConnection();
      },
      error => {
        this.toast.error('Error',  'fail to add the user '+user.name+' to the room '+ this.selected_group['name'], {
          closeButton: true
        });
        console.log('fail to add the user '+user.name+' to the room '+ this.selected_group['name'])}
    );
    modal.dismiss('Submitting the form');
  }

  activateCharRoom(room_id:number, room_name?:string){
    this.setVisible(room_id, room_name);
    this.current_room_id = room_id;
    console.log(room_id, this.room_display);
    // scroll to the botom
    this.triggerScrollTo('room_'+String(room_id));
  }

  send_new_message(room_id:number, room_name:string){
    if(this.text_message.length<1){
      return;
    }else{      
      var message ={
        employee_id :this.current_emp_id,
        room_id : room_id,
        room : room_name,
        message : this.text_message
      }
      console.log('post message',message)
      this.chatserv.post_in_room('text', message);
      // clear the message textarea
      this.text_message='';
    }
  }

  keyPress(event: any, room_id:number, room_name:string) {
    var code = (event.keyCode ? event.keyCode : event.which);
    if (code == 13) { //Enter keycode
      if (event.shiftKey){
        console.log('you press shift toooo, so avoid sending the message')
      }else{
        this.send_new_message(room_id, room_name);
      }
    }
  }


}

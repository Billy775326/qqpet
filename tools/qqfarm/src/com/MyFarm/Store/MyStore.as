package com.MyFarm.Store
{
   import com.MyFarm.Store.view.DisplayBox;
   import com.MyFarm.Store.view.ShowBox;
   import com.MyFarm.view.InstallFace;
   import com._public._method.ClearMemory;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.display.Stage;
   import flash.events.Event;
   import flash.events.IOErrorEvent;
   import flash.events.MouseEvent;
   import flash.filters.ColorMatrixFilter;
   import flash.net.URLLoader;
   import flash.net.URLRequest;
   import flash.text.TextField;
   import flash.text.TextFormat;
   
   public class MyStore
   {
      
      private var container:Sprite = new Sprite();
      
      private var margins:Number = 20;
      
      private var box:DisplayBox;
      
      private var stage:Stage;
      
      private var showBox:ShowBox;
      
      private var _showBoxArr:Array;
      
      private var install:InstallFace = InstallFace.getInstance();
      
      private var currentXML:XML;
      
      private var currentTab:String;
      
      private var rank:uint = 1;
      
      private var shown:Boolean = true;
      
      private var xml_array:Array = new Array();
      
      private var myBox:MovieClip;

      private var shopWidth:Number;

      private var catalogues:Object = {};

      private var cardsByTab:Object = {};

      private var loading:URLLoader;

      private var lastWealth:Number = -1;

      private var lastRank:int = -1;

      private var renderedTab:String = "";

      private var renderedOrder:String = "";

      private var status:TextField = new TextField();

      private var hint:Sprite;

      private var hintText:TextField;

      private var gray:Array = [new ColorMatrixFilter([0.3,0.59,0.11,0,0,0.3,0.59,0.11,0,0,0.3,0.59,0.11,0,0,0,0,0,0.5,0])];

      private const CARD_STEP_X:Number = 72;

      private const CARD_STEP_Y:Number = 88;
      
      public function MyStore(param1:MovieClip, param2:Stage, param3:Array)
      {
         super();
         stage = param2;
         _showBoxArr = param3;
         myBox = param1;
         shopWidth = myBox.width;
         xml_array["tab1"] = "com/MyFarm/data/xml/seed.xml";
         xml_array["tab2"] = "com/MyFarm/data/xml/props.xml";
         init();
      }
      
      private function tweenComplete() : void
      {
         myBox.parent.removeChild(myBox);
      }
      
      private function init() : void
      {
         myBox.tab1.buttonMode = true;
         myBox.tab2.buttonMode = true;
         myBox.tab3.buttonMode = true;
         myBox.tab1.gotoAndStop(2);
         currentTab = "tab1";
         addListen();
         loaderXML(xml_array["tab1"]);
         container.name = "container";
         myBox.addChild(container);
         container.addEventListener(MouseEvent.CLICK,clickHandler);
         container.addEventListener(MouseEvent.MOUSE_OVER,showHint);
         container.addEventListener(MouseEvent.MOUSE_MOVE,moveHint);
         container.addEventListener(MouseEvent.MOUSE_OUT,hideHint);
         status.name = "shopStatus";
         status.defaultTextFormat = new TextFormat(null,11,9782304);
         status.mouseEnabled = false;
         status.x = myBox.tab2.x + myBox.tab2.width + 10;
         status.y = myBox.tab1.y;
         status.width = shopWidth - status.x - 18;
         status.height = 20;
         myBox.addChild(status);
         myBox.addEventListener(Event.ENTER_FRAME,refresh);
         myBox.addEventListener(MouseEvent.MOUSE_WHEEL,wheelHandler);
      }
      
      private function refresh(param1:Event) : void
      {
         if(!myBox.visible)
         {
            if(shown) hideHint();
            shown = false;
            return;
         }
         var reopening:Boolean = !shown;
         shown = true;
         rank = int(install._user.rank);
         if(reopening && currentXML == null && loading == null) loaderXML(xml_array[currentTab]);
         if(currentXML != null && (lastRank != rank || lastWealth != Number(install._user.wealth)))
         {
            getXML(currentXML);
         }
      }
      
      private function loaderXML(param1:String) : void
      {
         stopLoading();
         if(catalogues[currentTab] != null)
         {
            getXML(catalogues[currentTab]);
            return;
         }
         status.text = "正在读取商品…";
         loading = new URLLoader();
         loading.addEventListener(Event.COMPLETE,loadXMLComplete);
         loading.addEventListener(IOErrorEvent.IO_ERROR,loadXMLError);
         loading.load(new URLRequest(param1));
      }

      private function stopLoading() : void
      {
         if(loading == null) return;
         loading.removeEventListener(Event.COMPLETE,loadXMLComplete);
         loading.removeEventListener(IOErrorEvent.IO_ERROR,loadXMLError);
         try { loading.close(); }
         catch(error:Error) { trace("Farm shop catalogue request already finished: " + error.message); }
         loading = null;
      }
      
      private function buySomething(param1:uint, param2:Number) : void
      {
         var _loc3_:uint = 0;
         var _loc4_:uint = 0;
         var _loc5_:int = 0;
         var _loc6_:uint = 0;
         var item:XML = currentXML.item[param1];
         var obj:String = String(item.@object);
         _loc3_ = int(currentTab.slice(3,4)) - 1;
         if(!canBuy(item))
         {
            _showBoxArr[_loc3_].info.text = "当前等级或元宝不足，无法购买";
            return;
         }
         if(param2 <= int(install._user.wealth))
         {
            _loc4_ = param2 / int(item.@price);
            if(obj.indexOf("Fertilizer") == 0 && obj.charAt(obj.length - 1) == "P")
            {
               obj = obj.slice(0,-1);
               item = currentXML.item.(@object == obj)[0];
               _loc4_ *= 7;
            }
            install._user.wealth = int(install._user.wealth) - param2;
            _loc5_ = -1;
            while(_loc6_ < install._user.burden.length)
            {
               if(install._user.burden[_loc6_].Items == item.@object)
               {
                  _loc5_ = int(_loc6_);
                  break;
               }
               _loc6_++;
            }
            if(_loc5_ > -1)
            {
               install._user.burden[_loc5_].number = int(install._user.burden[_loc5_].number) + _loc4_;
            }
            else
            {
               install._user.burden.push({
                  "name":String(item.@name),
                  "Items":String(item.@object),
                  "number":_loc4_
               });
            }
            install.showBurden();
            install.changeExp();
            _showBoxArr[_loc3_].info.text = "";
            showBox.close();
            install.so.data.user = install._user;
            install.so.flush();
            getXML(currentXML);
            status.text = "购买成功：" + String(item.@name) + " ×" + _loc4_ + "，花费" + param2 + "元宝";
         }
         else
         {
            _showBoxArr[_loc3_].info.text = "元宝不足!!!";
         }
      }
      
      private function addListen() : void
      {
         myBox.tab1.addEventListener(MouseEvent.CLICK,tabChange);
         myBox.tab2.addEventListener(MouseEvent.CLICK,tabChange);
         myBox.tab3.addEventListener(MouseEvent.CLICK,tabChange);
      }
      
      public function set currentRank(param1:uint) : void
      {
         rank = param1;
      }
      
      private function getXML(param1:XML) : void
      {
         hideHint();
         currentXML = param1;
         var top:Number = myBox.tab1.y + myBox.tab1.height + margins;
         var columns:int = Math.max(1,int((shopWidth - margins * 2) / CARD_STEP_X));
         var sameTab:Boolean = renderedTab == currentTab;
         if(!sameTab) clear();
         var cards:Array = cardsByTab[currentTab] as Array;
         if(cards == null) { cards = []; cardsByTab[currentTab] = cards; }
         var order:Array = new Array();
         var k:uint = 0;
         while(k < param1.item.length())
         {
            if(canBuy(param1.item[k]))
            {
               order.push(k);
            }
            k++;
         }
         k = 0;
         while(k < param1.item.length())
         {
            if(!canBuy(param1.item[k]))
            {
               order.push(k);
            }
            k++;
         }
         var changedOrder:Boolean = !sameTab || renderedOrder != order.join(",");
         for(var position:int = 0;position < order.length;position++)
         {
            k = uint(order[position]);
            box = cards[k] as DisplayBox;
            if(box == null)
            {
               if(param1.item[k].@url != undefined)
                  box = new DisplayBox(param1.item[k].@url,stage,param1.item[k].@price,null,param1.item[k].@name,param1.item[k].@information);
               else
                  box = new DisplayBox("",stage,param1.item[k].@price,createClip(param1.item[k].@object),param1.item[k].@name,param1.item[k].@information);
               box.name = k.toString();
               cards[k] = box;
            }
            var available:Boolean = canBuy(param1.item[k]);
            if(box.available != available)
            {
               box.filters = available ? [] : gray;
               box.available = available;
            }
            if(changedOrder)
            {
               box.x = margins + CARD_STEP_X * (position % columns);
               box.y = top + CARD_STEP_Y * int(position / columns);
               container.addChild(box);
            }
         }
         // Rebinding the legacy scrollbar resets its origin. Same-category
         // refreshes keep the existing mask/handler and the browsing position.
         if(!sameTab)
         {
            container.y = 0;
            myBox.scrollBar.y = top;
            myBox.scrollBar.effectObject = "container";
         }
         renderedTab = currentTab;
         renderedOrder = order.join(",");
         lastRank = rank;
         lastWealth = Number(install._user.wealth);
      }
      
      private function showHint(event:MouseEvent) : void
      {
         var card:DisplayBox = event.target as DisplayBox;
         if(card == null || currentXML == null || (showBox != null && showBox.isOpen)) return;
         if(hint == null)
         {
            hint = new Sprite();
            hint.name = "shopHint";
            hint.mouseEnabled = false;
            hint.mouseChildren = false;
            hintText = new TextField();
            hintText.defaultTextFormat = new TextFormat(null,12,0);
            hintText.wordWrap = true;
            hintText.width = 230;
            hintText.autoSize = "left";
            hintText.x = hintText.y = 6;
            hint.addChild(hintText);
         }
         var item:XML = currentXML.item[int(card.name)];
         var message:String = String(item.@name) + "\n购买价：" + item.@price + " 元宝";
         if(currentTab == "tab1")
         {
            message += "\n解锁等级：" + item.@rank + " 级\n成熟时间：" + item.@maturation + " 小时\n作物出售单价：" + item.@prices + " 元宝";
         }
         if(!canBuy(item)) message += int(item.@rank) > rank ? "\n当前农场等级不足" : "\n当前元宝不足";
         if(String(item.@information) != "") message += "\n" + item.@information;
         hintText.text = message;
         hint.graphics.clear();
         hint.graphics.lineStyle(1,48343,0.8);
         hint.graphics.beginFill(16777215,0.94);
         hint.graphics.drawRect(0,0,242,hintText.height + 12);
         hint.graphics.endFill();
         stage.addChild(hint);
         moveHint();
      }

      private function moveHint(event:MouseEvent = null) : void
      {
         if(hint == null || hint.parent == null) return;
         hint.x = Math.max(0,Math.min(stage.mouseX + 12,stage.stageWidth - hint.width));
         hint.y = stage.mouseY + 18;
         if(hint.y + hint.height > stage.stageHeight) hint.y = Math.max(0,stage.mouseY - hint.height - 10);
      }

      private function hideHint(event:MouseEvent = null) : void
      {
         if(hint != null && hint.parent != null) hint.parent.removeChild(hint);
      }

      private function wheelHandler(event:MouseEvent) : void
      {
         if(!myBox.visible || (showBox != null && showBox.isOpen)) return;
         hideHint();
         myBox.scrollBar.scrollBy(-event.delta * 18);
         event.stopPropagation();
      }
      
      private function canBuy(param1:XML) : Boolean
      {
         return int(param1.@rank) <= rank && int(param1.@price) <= int(install._user.wealth);
      }
      
      private function tabChange(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = null;
         if(param1.target.name == currentTab)
         {
            return;
         }
         switch(param1.target.name)
         {
            case "tab1":
            case "tab2":
            case "tab3":
               clear();
               _loc2_ = myBox.getChildByName(currentTab) as MovieClip;
               if(_loc2_ != null)
               {
                  _loc2_.gotoAndStop(1);
               }
               currentTab = param1.target.name;
               param1.target.gotoAndStop(2);
               currentXML = null;
               status.text = "";
               loaderXML(xml_array[currentTab]);
         }
      }
      
      private function clickHandler(param1:MouseEvent) : void
      {
         hideHint();
         if(showBox != null && showBox.isOpen)
         {
            return;
         }
         var _loc2_:uint = 0;
         var _loc3_:uint = 0;
         var _loc4_:Object = null;
         var _loc5_:MovieClip = null;
         // The item box is named after its index; a click may land on the box itself or anything nested in it.
         var hit:DisplayObject = param1.target as DisplayObject;
         while(hit != null && hit.parent != container)
         {
            hit = hit.parent;
         }
         if(hit == null)
         {
            return;
         }
         _loc2_ = int(currentTab.slice(3,4)) - 1;
         _loc3_ = uint(int(hit.name));
         _loc4_ = new Object();
         _loc4_.price = currentXML.item[_loc3_].@price;
         _loc4_.name = currentXML.item[_loc3_].@name;
         _loc4_.information = currentXML.item[_loc3_].@information;
         _loc4_.type = currentXML.item[_loc3_].@type;
         _loc4_.maturation = currentXML.item[_loc3_].@maturation;
         _loc4_.experience = currentXML.item[_loc3_].@experience;
         _loc4_.rank = currentXML.item[_loc3_].@rank;
         _loc4_.yield = currentXML.item[_loc3_].@yield;
         _loc4_.prices = currentXML.item[_loc3_].@prices;
         _loc4_.info = currentXML.item[_loc3_];
         _loc4_.id = _loc3_;
         _loc4_.revenue = Number(_loc4_.yield) * Number(_loc4_.prices);
         _showBoxArr[_loc2_].define.mouseEnabled = true;
         _showBoxArr[_loc2_].info.text = "";
         if(_loc2_ == 0)
         {
            if(int(_loc4_.rank) > rank)
            {
               _showBoxArr[_loc2_].define.mouseEnabled = false;
               _showBoxArr[_loc2_].info.text = "等级不够，无法购买!";
            }
            else
            {
               _showBoxArr[_loc2_].define.mouseEnabled = true;
               _showBoxArr[_loc2_].info.text = "";
            }
         }
         else if(_loc2_ != 1)
         {
            if(_loc2_ == 2)
            {
            }
         }
         _showBoxArr[_loc2_].info.mouseEnabled = false;
         if(Number(_loc4_.price) > Number(install._user.wealth))
         {
            _showBoxArr[_loc2_].define.mouseEnabled = false;
            _showBoxArr[_loc2_].info.text = "元宝不足，需 " + _loc4_.price + " 元宝";
         }
         if(currentXML.item[_loc3_].@url != undefined)
         {
            showBox = new ShowBox(_showBoxArr[_loc2_],currentTab,currentXML.item[_loc3_].@url,null,_loc4_,buySomething);
         }
         else
         {
            _loc5_ = createClip(currentXML.item[_loc3_].@object);
            showBox = new ShowBox(_showBoxArr[_loc2_],currentTab,"",_loc5_,_loc4_,buySomething);
         }
         stage.addChild(_showBoxArr[_loc2_]);
         _showBoxArr[_loc2_].x = myBox.x + (myBox.width - _showBoxArr[_loc2_].width) / 2;
         _showBoxArr[_loc2_].y = myBox.y + (300 - _showBoxArr[_loc2_].height) / 2;
         showBox.beginShow();
      }
      
      private function loadXMLComplete(param1:Event) : void
      {
         if(param1.target != loading) return;
         var data:String = String(loading.data);
         loading.removeEventListener(Event.COMPLETE,loadXMLComplete);
         loading.removeEventListener(IOErrorEvent.IO_ERROR,loadXMLError);
         loading = null;
         var catalogue:XML;
         try
         {
            catalogue = new XML(data);
         }
         catch(error:Error)
         {
            status.text = "商品目录读取失败，请重开商店";
            trace("Farm shop catalogue parse failed: " + error.message);
            return;
         }
         catalogues[currentTab] = catalogue;
         status.text = "";
         getXML(catalogue);
      }

      private function loadXMLError(event:IOErrorEvent) : void
      {
         if(event.target != loading) return;
         loading.removeEventListener(Event.COMPLETE,loadXMLComplete);
         loading.removeEventListener(IOErrorEvent.IO_ERROR,loadXMLError);
         loading = null;
         status.text = "商品目录读取失败，请重开商店";
         trace("Farm shop catalogue load failed: " + event.text);
      }
      
      public function clearMemory() : void
      {
         var _loc1_:ClearMemory = null;
         _loc1_ = ClearMemory.getInstance();
         myBox.tab1.removeEventListener(MouseEvent.CLICK,tabChange);
         myBox.tab2.removeEventListener(MouseEvent.CLICK,tabChange);
         myBox.tab3.removeEventListener(MouseEvent.CLICK,tabChange);
         myBox.removeEventListener(Event.ENTER_FRAME,refresh);
         myBox.removeEventListener(MouseEvent.MOUSE_WHEEL,wheelHandler);
         stopLoading();
         hideHint();
         container.removeEventListener(MouseEvent.CLICK,clickHandler);
         container.removeEventListener(MouseEvent.MOUSE_OVER,showHint);
         container.removeEventListener(MouseEvent.MOUSE_MOVE,moveHint);
         container.removeEventListener(MouseEvent.MOUSE_OUT,hideHint);
         catalogues = {};
         cardsByTab = {};
         box = null;
         while(container.numChildren > 0)
         {
            container.removeChildAt(0);
         }
         container = null;
         currentXML = null;
         myBox = null;
         _showBoxArr = new Array();
         stage = null;
         _loc1_.runClear();
      }
      
      private function clear() : void
      {
         hideHint();
         renderedTab = "";
         renderedOrder = "";
         var _loc1_:uint = 0;
         _loc1_ = uint(container.numChildren);
         while(_loc1_ > 0)
         {
            container.removeChildAt(_loc1_ - 1);
            _loc1_--;
         }
      }
      
      private function createClip(param1:String) : MovieClip
      {
         return install.getChild(param1);
      }
   }
}


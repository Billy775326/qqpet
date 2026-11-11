package com.tencent.QQPet.FishSNS.View.fishshop
{
   import com.hexagonstar.util.debug.Debug;
   import com.tencent.QQPet.Component.baseui.lists.BaseGridList;
   import com.tencent.QQPet.Component.baseui.lists.ListEvent;
   import com.tencent.QQPet.FishSNS.Define;
   import com.tencent.QQPet.FishSNS.Events.CommandEvent;
   import com.tencent.QQPet.FishSNS.Events.CommandEventDispatcher;
   import com.tencent.QQPet.FishSNS.Protocol.ProtocolLocator;
   import com.tencent.QQPet.FishSNS.View.UISystem;
   import com.tencent.QQPet.FishSNS.View.dialogs.ConfirmDialog;
   import com.tencent.QQPet.FishSNS.View.dialogs.VipErrDialog;
   import com.tencent.QQPet.FishSNS.client.ClientNet;
   import com.tencent.QQPet.FishSNS.data.FryData;
   import com.tencent.QQPet.FishSNS.data.ModelLocator;
   import flash.display.SimpleButton;
   import flash.display.Sprite;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.geom.Point;
   import flash.geom.Rectangle;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import flash.utils.Timer;
   import flash.events.TimerEvent;
   import flash.events.Event;

   public class FishShop extends Sprite
   {

      private const LIST_POS:Point = new Point(26,12);

      private const PAY_MODE_POS:Point = new Point(12,120);

      private var list:BaseGridList;

      public var prevpagebtn:SimpleButton;

      public var nextpagebtn:SimpleButton;

      public var closebtn:SimpleButton;

      private var ui:ListPaneUI;

      private var payPanel:PayPanel;

      private var confirmDialog:ConfirmDialog = new ConfirmDialog();

      private var errDialog:ConfirmDialog = new ConfirmDialog(null,false,true);

      private var vipErrDialog:VipErrDialog = new VipErrDialog(null,true,true);

      private var firstShop:Boolean = true;

      private var stockCount:int = 1;
      private var stockFry:int = 0;
      private var stockMax:int = 0;
      private var confirmedFry:int = 0;
      private var confirmedCount:int = 0;
      private var buying:Boolean = false;
      private var minus:SimpleButton;
      private var plus:SimpleButton;
      private var countText:TextField;
      private var totalText:TextField;
      private var availableText:TextField;
      private var stockPay:SimpleButton;
      private var stockTimer:Timer = new Timer(500);

      public function FishShop()
      {
         super();
         ProtocolLocator.getInstance().buyProtocol.addEventListener(CommandEvent.SER_BUY,this.onSerBuy);
         ProtocolLocator.getInstance().shopProtocol.addEventListener(CommandEvent.SER_SHOP,this.setData);
         this.addChild(this.ui = new ListPaneUI());
         this.prevpagebtn = this.ui.prevpagebtn;
         this.nextpagebtn = this.ui.nextpagebtn;
         this.closebtn = this.ui.closebtn;
         this.payPanel = new PayPanel();
         this.addChild(this.payPanel);
         this.payPanel.addEventListener(CommandEvent.PAY_UI_ONPAY,this.onPay);
         this.payPanel.x = this.PAY_MODE_POS.x;
         this.payPanel.y = this.PAY_MODE_POS.y;
         this.list = new BaseGridList(FryItem,1,3,3);
         this.list.addEventListener(ListEvent.ITEM_CLICKED,this.onItemClicked);
         this.list.x = this.LIST_POS.x;
         this.list.y = this.LIST_POS.y;
         this.addChild(this.list);
         this.addListen();
         this.errDialog.addEventListener(TextEvent.LINK,this.onChongzhi);
         this.confirmDialog.setConfirmFun(this.sendBuy);
         this.confirmDialog.setCancelFun(this.cancelStock);
         (this.confirmDialog.getChildAt(0) as ConfirmDialogUI).closebtn.addEventListener(MouseEvent.CLICK,this.cancelStock);
         this.vipErrDialog.setConfirmFun(this.regVip);
         this.initQuantity();
      }

      // Keep original Flash controls, skin and fonts while tightening the two rows.
      private function initQuantity() : void
      {
         // Compress only the empty strip below the fish cards. Preserve the
         // border corners, top artwork and lower divider at their original size.
         var panelBounds:Object = this.ui.bg.getBounds(this.ui.bg);
         this.ui.bg.scale9Grid = new Rectangle(panelBounds.x + 10,panelBounds.y + 103,
            panelBounds.width - 20,Math.max(1,panelBounds.height - 137));
         this.ui.bg.height -= 12;
         this.payPanel.getPayModeGroup().visible = false;
         for(var i:int = 0; i < this.payPanel.numChildren; i++)
         {
            var pane:ImmediateBuyPaneUI = this.payPanel.getChildAt(i) as ImmediateBuyPaneUI;
            if(pane == null) continue;
            this.stockPay = pane.paybtn;
            for(var j:int = 0; j < pane.numChildren; j++)
               if(pane.getChildAt(j) != this.stockPay) pane.getChildAt(j).visible = false;
         }
         this.addChild(this.stockPay);
         var row:Sprite = new Sprite();
         row.x = 26;
         row.y = 104;
         row.addChild(this.stockLabel("数量",0,34));
         this.minus = this.stockButton(false,38,this.lessStock);
         this.plus = this.stockButton(true,82,this.moreStock);
         row.addChild(this.minus);
         row.addChild(this.plus);
         this.countText = this.stockLabel("1",55,24);
         var centered:TextFormat = this.countText.defaultTextFormat;
         centered.align = "center";
         this.countText.defaultTextFormat = centered;
         this.countText.setTextFormat(centered);
         row.addChild(this.countText);
         row.addChild(this.stockLabel("条",104,20));
         this.addChild(row);
         this.availableText = this.stockLabel("",167,115);
         this.availableText.y = row.y;
         this.addChild(this.availableText);
         this.totalText = this.stockLabel("",26,175);
         this.totalText.y = 128;
         this.addChild(this.totalText);
         this.stockTimer.addEventListener(TimerEvent.TIMER,this.refreshQuantity);
         this.addEventListener(Event.ADDED_TO_STAGE,this.startQuantity);
         this.addEventListener(Event.REMOVED_FROM_STAGE,this.stopQuantity);
      }

      private function stockLabel(text:String, x:Number, width:Number) : TextField
      {
         var field:TextField = new FUIFry().fname;
         var original:TextFormat = field.getTextFormat();
         original.align = "left";
         field.defaultTextFormat = original;
         field.text = text;
         field.x = x;
         field.y = 0;
         field.width = width;
         field.height = 19;
         field.selectable = false;
         field.mouseEnabled = false;
         return field;
      }

      private function stockButton(next:Boolean, x:Number, handler:Function) : SimpleButton
      {
         var source:ListPaneUI = new ListPaneUI();
         var button:SimpleButton = next ? source.nextpagebtn : source.prevpagebtn;
         // Library arrows have registration offsets; align their visible bounds,
         // rather than their timeline origins, with the small quantity label.
         var bounds:Object = button.getBounds(button);
         button.scaleX = button.scaleY = 16 / bounds.height;
         button.x = x - bounds.x * button.scaleX;
         button.y = 2 - bounds.y * button.scaleY;
         button.visible = true;
         button.addEventListener(MouseEvent.CLICK,handler);
         return button;
      }

      private function startQuantity(event:Event) : void { this.stockTimer.start(); }
      private function stopQuantity(event:Event) : void { this.stockTimer.stop(); }

      private function stockQuote(fry:FryData) : Object
      {
         if(fry == null) return {max:0,price:0,reason:"请选择鱼苗"};
         return ExternalInterface.call("QQPetPondStockQuote",fry.fryid,1);
      }

      private function refreshQuantity(event:TimerEvent = null) : void
      {
         if(!this.visible || this.buying) return;
         var fry:FryData = ModelLocator.getInstance().fishshopData.getSelectedFry();
         var quote:Object = this.stockQuote(fry);
         if(fry == null || fry.fryid != this.stockFry)
         {
            this.stockCount = 1;
            this.stockFry = fry == null ? 0 : fry.fryid;
         }
         this.stockMax = quote == null ? 0 : int(quote.max);
         this.stockCount = Math.max(1,Math.min(this.stockCount,this.stockMax));
         this.countText.text = String(this.stockCount);
         this.minus.enabled = this.stockCount > 1;
         this.plus.enabled = this.stockCount < this.stockMax;
         this.minus.alpha = this.minus.enabled ? 1 : 0.4;
         this.plus.alpha = this.plus.enabled ? 1 : 0.4;
         this.availableText.text = quote == null ? "暂时无法投放" : this.stockMax == 0
            ? String(quote.reason) : "可投放 " + this.stockMax + " 条";
         this.totalText.text = quote == null ? "" : "合计 " + (int(quote.price) * this.stockCount) + " 元宝";
         var bounds:Object = this.stockPay.getBounds(this.stockPay);
         this.stockPay.x = 282 - (bounds.x + bounds.width) * this.stockPay.scaleX;
         this.stockPay.y = 130 - bounds.y * this.stockPay.scaleY;
         this.stockPay.enabled = this.stockMax > 0;
         this.stockPay.alpha = this.stockPay.enabled ? 1 : 0.4;
      }

      private function lessStock(event:MouseEvent) : void
      {
         this.refreshQuantity();
         this.stockCount = Math.max(1,this.stockCount - 1);
         this.refreshQuantity();
      }

      private function moreStock(event:MouseEvent) : void
      {
         this.refreshQuantity();
         this.stockCount = Math.min(this.stockMax,this.stockCount + 1);
         this.refreshQuantity();
      }

      private function cancelStock(event:MouseEvent = null) : void
      {
         this.confirmedCount = 0;
      }

      public function setData(param1:CommandEvent = null) : void
      {
         this.list.dataProvider.setData(ModelLocator.getInstance().fishshopData.getFryArr());
         this.showPageAt(0);
      }

      private function addListen() : void
      {
         this.prevpagebtn.addEventListener(MouseEvent.CLICK,this.onPrev);
         this.nextpagebtn.addEventListener(MouseEvent.CLICK,this.onNext);
         this.closebtn.addEventListener(MouseEvent.CLICK,this.hide);
      }

      private function onPrev(param1:MouseEvent) : void
      {
         trace("currentpage:" + this.list.getCurrentPage() + ":len:" + (this.list.getPageCount() - 1));
         if(this.list.getCurrentPage() <= 0)
         {
            this.showPageAt(this.list.getPageCount() - 1);
         }
         else
         {
            this.showPageAt(this.list.getCurrentPage() - 1);
         }
      }

      private function onNext(param1:MouseEvent) : void
      {
         trace("currentpage:" + this.list.getCurrentPage() + ":len:" + (this.list.getPageCount() - 1));
         if(this.list.getCurrentPage() >= this.list.getPageCount() - 1)
         {
            this.showPageAt(0);
         }
         else
         {
            this.showPageAt(this.list.getCurrentPage() + 1);
         }
      }

      private function onItemClicked(param1:ListEvent) : void
      {
         this.payPanel.getPayModeGroup().setYBAble(true);
         this.payPanel.getPayModeGroup().setMode(Define.PAY_MODE_YUANBAO);
         this.payPanel.onPayModeChange();
         var _loc2_:FryData = param1.getData() as FryData;
         if(_loc2_.flag == 1 && ClientNet.getInstance().getSelfVip() == false)
         {
            ExternalInterface.call("alert","很抱歉，您选择的 " + _loc2_.name + " 只有粉钻用户可以使用，请开通后再来使用吧！");
         }
         if(_loc2_.canSelected == false)
         {
            return;
         }
         var _loc3_:* = !_loc2_.selected;
         ModelLocator.getInstance().fishshopData.clearAllSelected();
         _loc2_.selected = _loc3_;
         this.list.showPageAt(this.list.getCurrentPage());
         if(_loc2_.selected == true && _loc2_.price_yb <= 0)
         {
            this.payPanel.getPayModeGroup().setMode(Define.PAY_MODE_QBI);
            this.payPanel.getPayModeGroup().setYBAble(false);
            this.payPanel.onPayModeChange();
         }
         this.refreshQuantity();
      }

      public function show() : void
      {
         this.stockCount = 1;
         this.confirmedCount = 0;
         this.visible = true;
         if(this.firstShop)
         {
            this.updataShopData();
            this.firstShop = false;
         }
         this.refreshQuantity();
      }

      public function updataShopData() : void
      {
         ProtocolLocator.getInstance().shopProtocol.sendRequest();
      }

      public function hide(param1:MouseEvent = null) : void
      {
         this.visible = false;
         this.confirmedCount = 0;
         this.confirmDialog.hide();
      }

      private function onPay(param1:CommandEvent) : void
      {
         if(this.buying || this.confirmDialog.visible) return;
         var previousCount:int = this.stockCount;
         this.refreshQuantity();
         if(previousCount != this.stockCount)
         {
            this.errDialog.setInfo("可投放数量已变化，请核对后重新确认。");
            this.errDialog.show();
            return;
         }
         var _loc3_:* = null;
         this.payPanel.getCurrentType();
         this.payPanel.getTypeWithAppend();
         var _loc2_:FryData = ModelLocator.getInstance().fishshopData.getSelectedFry();
         if(_loc2_ == null)
         {
            this.errDialog.setInfo("还没有选择鱼苗");
            this.errDialog.show();
         }
         else
         {
            if(this.stockMax == 0)
            {
               this.errDialog.setInfo(this.availableText.text);
               this.errDialog.show();
               return;
            }
            if(!ClientNet.getInstance().getSelfVip() && ModelLocator.getInstance().pondData.getFishCnt() >= Define.NO_VIP_MAX_FISHES)
            {
               this.errDialog.setInfo("您的池塘已经放满" + Define.NO_VIP_MAX_FISHES + "条鱼苗啦，再继续放就会弄得池塘臭熏熏了！（开通粉钻可以养" + Define.VIP_MAX_FISHES + "条鱼苗，" + "<a href=\'event:" + "lijikaitong" + "\'>" + "<font COLOR=\'#fc5050\'><u>立即开通</u></font>" + "</a>" + "吧！）");
               this.errDialog.show();
               return;
            }
            if(ClientNet.getInstance().getSelfVip() && ModelLocator.getInstance().pondData.getFishCnt() >= Define.VIP_MAX_FISHES)
            {
               this.errDialog.setInfo("您的池塘已经放满" + Define.VIP_MAX_FISHES + "条鱼苗啦，再继续放就会弄得池塘臭熏熏了！");
               this.errDialog.show();
               return;
            }
            Debug.traceObj(_loc2_);
            _loc3_ = "";
            this.confirmedFry = _loc2_.fryid;
            this.confirmedCount = this.stockCount;
            _loc3_ += "您准备投放" + Define.COLOR_RED + this.confirmedCount + "条" + _loc2_.name + "</font>鱼苗，合计需要消耗";
            _loc3_ += Define.COLOR_RED;
            _loc3_ += this.stockQuote(_loc2_).price * this.confirmedCount + "元宝";
            _loc3_ += "</font>";
            _loc3_ += "，确认支付吗？";
            this.confirmDialog.setInfo(_loc3_);
            this.confirmDialog.show();
         }
      }

      private function sendBuy() : void
      {
         if(!this.visible || this.buying || this.confirmedCount <= 0) return;
         var count:int = this.confirmedCount;
         this.confirmedCount = 0;
         this.buying = true;
         UISystem.getInstance().setStageModelVisible(true);
         ProtocolLocator.getInstance().buyProtocol.setParam(this.confirmedFry,1,count);
         ProtocolLocator.getInstance().buyProtocol.send();
      }

      private function onSerBuy(param1:CommandEvent) : void
      {
         this.buying = false;
         UISystem.getInstance().setStageModelVisible(false);
         if(ProtocolLocator.getInstance().buyProtocol.buyOK)
         {
            this.bufFrySuccess();
         }
         else
         {
            this.errDialog.setInfo(ProtocolLocator.getInstance().buyProtocol.errMsg);
            this.errDialog.show();
            this.refreshQuantity();
         }
      }

      private function bufFrySuccess() : void
      {
         this.hide();
         CommandEventDispatcher.getInstance().dispatchEvent(new CommandEvent(CommandEvent.SYS_BUY_FRY_OK));
      }

      private function onChongzhi(param1:TextEvent) : void
      {
         switch(param1.text)
         {
            case "chongzhi":
               ClientNet.getInstance().openWeb(Define.URL_CHONGZHI);
               break;
            case "lijikaitong":
               this.regVip();
         }
      }

      private function regVip() : void
      {
         ClientNet.getInstance().openWindow(Define.URL_KAITONGFENZUAN);
      }

      private function showPageAt(param1:int) : void
      {
         var _loc2_:FryData = null;
         ModelLocator.getInstance().fishshopData.clearAllSelected();
         var _loc3_:int = 0;
         this.payPanel.getPayModeGroup().setYBAble(true);
         this.payPanel.getPayModeGroup().setMode(Define.PAY_MODE_YUANBAO);
         this.payPanel.onPayModeChange();
         while(_loc3_ <= 2)
         {
            _loc2_ = ModelLocator.getInstance().fishshopData.getFryByIndex(param1 * this.list.maxItemCount + _loc3_);
            if(_loc2_ == null)
            {
               break;
            }
            if(_loc2_.canSelected)
            {
               _loc2_.selected = true;
               if(_loc2_.price_yb <= 0)
               {
                  this.payPanel.getPayModeGroup().setMode(Define.PAY_MODE_QBI);
                  this.payPanel.getPayModeGroup().setYBAble(false);
                  this.payPanel.onPayModeChange();
               }
               _loc3_ = 3;
            }
            _loc3_++;
         }
         this.list.showPageAt(param1);
         this.stockFry = 0;
         this.refreshQuantity();
      }
   }
}

package com.tencent.QQPet.FishSNS.Protocol
{
   import com.tencent.QQPet.FishSNS.Common.Config;
   import com.tencent.QQPet.FishSNS.Common.ProtocolConst;
   import com.tencent.QQPet.FishSNS.Define;
   import com.tencent.QQPet.FishSNS.Events.CommandEvent;
   import com.tencent.QQPet.FishSNS.client.ClientNet;
   import com.tencent.QQPet.NetWork.ProtocolData;

   public class BuyProtocol extends FishSNSProtocol
   {

      public var buyOK:Boolean;

      public var errMsg:String;

      private var errArr:Array = ["","余额不足","超过数量限制"];

      public function BuyProtocol()
      {
         super(ProtocolConst.PID_BUY,Config.protocolTimeout);
         var _loc1_:Object = new Object();
         super.body = _loc1_;
      }

      public function setParam(param1:int, param2:int, count:int = 1) : void
      {
         super.body.fryid = param1;
         super.body.paytype = param2;
         super.body.count = count;
         super.body.sign = ClientNet.getInstance().getPetSign();
      }

      override public function send() : Boolean
      {
         var _loc1_:Boolean = super.send();
         super.reset();
         return _loc1_;
      }

      override public function result(param1:ProtocolData) : void
      {
         super.result(param1);
         if(String(param1.data.result) == "0")
         {
            this.buyOK = true;
         }
         else if(super.body.paytype == Define.PAY_MODE_YUANBAO && String(param1.data.result) == "1")
         {
            this.buyOK = false;
            this.errMsg = "很抱歉，您已经没有足够的元宝购买该鱼苗，请攒够元宝再来吧！";
         }
         else if(String(param1.data.result) == "1")
         {
            this.buyOK = false;
            this.errMsg = "很抱歉，您已经没有足够的QB购买该鱼苗，立即" + "<a>" + "<font COLOR=\'#fc5050\'><u>充值</u></font>" + "</a>" + "购买吧！";
         }
         else if(String(param1.data.result) == "2")
         {
            this.buyOK = false;
            this.errMsg = "您购买的鱼苗已经超过数量限制。";
         }
         else
         {
            this.buyOK = false;
            this.errMsg = param1.data.msg + "";
         }
         this.dispatchEvent(new CommandEvent(CommandEvent.SER_BUY));
      }
   }
}

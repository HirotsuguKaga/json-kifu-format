/// <reference path="./JSONKifuFormat.d.ts" />
/// <reference path="../Shogi.js/src/shogi.ts" />
/// <reference path="./normalizer.ts" />

/** @license
 * JSON Kifu Format
 * Copyright (c) 2014 na2hiro (https://github.com/na2hiro)
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */

class JKFPlayer{
	shogi: Shogi;
	kifu: JSONKifuFormat;
	tesuu: number;
	forks: {te: number; moves: MoveFormat[]}[];
	static debug = false;
	static _log = [];
	static log(...lg: any[]){
		if(JKFPlayer.debug){
			console.log(lg);
		}else{
			JKFPlayer._log.push(lg);
		}
	}
	constructor(kifu: JSONKifuFormat){
		this.shogi = new Shogi(kifu.initial || undefined);
		this.initialize(kifu);
	}
	initialize(kifu: JSONKifuFormat){
		this.kifu = kifu;
		this.tesuu = 0;
		this.forks = [{te: 0, moves: this.kifu.moves}];
	}
	static parse(kifu: string, filename?: string){
		if(filename){
			var tmp = filename.split("."), ext = tmp[tmp.length-1].toLowerCase();
			switch(ext){
				case "jkf":
					return JKFPlayer.parseJKF(kifu);
				case "kif": case "kifu":
					return JKFPlayer.parseKIF(kifu);
				case "ki2": case "ki2u":
					return JKFPlayer.parseKI2(kifu);
				case "csa":
					return JKFPlayer.parseCSA(kifu);
			}
		}
		// 不明
		try{
			return JKFPlayer.parseJKF(kifu);
		}catch(e){
			JKFPlayer.log("failed to parse as jkf", e);
		}
		try{
			return JKFPlayer.parseKIF(kifu);
		}catch(e){
			JKFPlayer.log("failed to parse as kif", e);
		}
		try{
			return JKFPlayer.parseKI2(kifu);
		}catch(e){
			JKFPlayer.log("failed to parse as ki2", e);
		}
		try{
			return JKFPlayer.parseCSA(kifu);
		}catch(e){
			JKFPlayer.log("failed to parse as csa", e);
		}
		throw "JKF, KIF, KI2, CSAいずれの形式でも失敗しました";
	}
	static parseJKF(kifu: string){
		JKFPlayer.log("parseJKF", kifu);
		return new JKFPlayer(JSON.parse(kifu));
	}
	static parseKIF(kifu: string){
		if(!JKFPlayer.kifParser) throw "パーサが読み込まれていません";
		JKFPlayer.log("parseKIF", kifu);
		return new JKFPlayer(Normalizer.normalizeKIF(JKFPlayer.kifParser.parse(kifu)));
	}
	static parseKI2(kifu: string){
		if(!JKFPlayer.ki2Parser) throw "パーサが読み込まれていません";
		JKFPlayer.log("parseKI2", kifu);
		return new JKFPlayer(Normalizer.normalizeKI2(JKFPlayer.ki2Parser.parse(kifu)));
	}
	static parseCSA(kifu: string){
		if(!JKFPlayer.csaParser) throw "パーサが読み込まれていません";
		JKFPlayer.log("parseCSA", kifu);
		return new JKFPlayer(Normalizer.normalizeCSA(JKFPlayer.csaParser.parse(kifu)));
	}
	static kifParser: {parse: (kifu: string)=>JSONKifuFormat};
	static ki2Parser: {parse: (kifu: string)=>JSONKifuFormat};
	static csaParser: {parse: (kifu: string)=>JSONKifuFormat};
	static numToZen(n: number){
		return "０１２３４５６７８９"[n];
	}
	static numToKan(n: number){
		return "〇一二三四五六七八九"[n];
	}
	static kindToKan(kind: string): string{
		return {
			"FU": "歩",
			"KY": "香",
			"KE": "桂",
			"GI": "銀",
			"KI": "金",
			"KA": "角",
			"HI": "飛",
			"OU": "玉",
			"TO": "と",
			"NY": "成香",
			"NK": "成桂",
			"NG": "成銀",
			"UM": "馬",
			"RY": "龍",
		}[kind];
	}
	static relativeToKan(relative: string){
		return {
			"L": "左",
			"C": "直",
			"R": "右",
			"U": "上",
			"M": "寄",
			"D": "引",
			"H": "打",
		}[relative];
	}
	static specialToKan(special: string){
		return {
			"TORYO": "投了",
			"CHUDAN": "中断",
			"SENNICHITE": "千日手",
			"TIME_UP": "時間切れ",
			"ILLEGAL_MOVE": "反則負け",
			"+ILLEGAL_ACTION": "後手反則負け",
			"-ILLEGAL_ACTION": "先手反則負け",
			"JISHOGI": "持将棋",
			"KACHI": "勝ち宣言",
			"HIKIWAKE": "引き分け宣言",
			"MATTA": "待った",
			"TSUMI": "詰",
			"FUZUMI": "不詰",
			"ERROR": "エラー",
		}[special] || special;
	}
	static moveToReadableKifu(mv: MoveFormat): string{
		if(mv.special){
			return JKFPlayer.specialToKan(mv.special);
		}
		var move = mv.move;
		var ret = move.color ? "☗" : "☖";
		if(move.same){
			ret+="同　";
		}else{
			ret+=JKFPlayer.numToZen(move.to.x)+JKFPlayer.numToKan(move.to.y);
		}
		ret+=JKFPlayer.kindToKan(move.piece);
		if(move.relative){
			ret+=move.relative.split("").map(JKFPlayer.relativeToKan).join("");
		}
		if(move.promote!=null){
			ret+=move.promote ? "成" : "不成";
		}
		return ret;
	}
	// 1手進める
	forward(){
		if(!this.getMoveFormat(this.tesuu+1)) return false;
		this.tesuu++;
		var move = this.getMoveFormat(this.tesuu).move;
		if(!move) return true;
		JKFPlayer.log("forward", this.tesuu, move);
		this.doMove(move);
		return true;
	}
	// 1手戻す
	backward(){
		if(this.tesuu<=0) return false;
		var move = this.getMoveFormat(this.tesuu).move;
		if(!move){ this.tesuu--; return true; }
		JKFPlayer.log("backward", this.tesuu-1, move);
		this.undoMove(move);
		this.tesuu--;
		this.forks = this.forks.filter((fork)=>fork.te<=this.tesuu);
		return true;
	}
	// tesuu手目へ行く
	goto(tesuu: number){
		var limit = 10000; // for safe
		if(this.tesuu<tesuu){
			while(this.tesuu!=tesuu && this.forward() && limit-->0);
		}else{
			while(this.tesuu!=tesuu && this.backward() && limit-->0);
		}
		if(limit==0) throw "tesuu overflows";
	}
	// tesuu手前後に移動する
	go(tesuu: number){
		this.goto(this.tesuu+tesuu);
	}
	// 現在の局面から別れた分岐のうちnum番目の変化へ1つ進む
	forkAndForward(num: number){
		this.forks.push({te: this.tesuu+1, moves: this.getMoveFormat(this.tesuu+1).forks[num]});
		this.forward();
	}
	// wrapper
	getBoard(x: number, y: number){
		return this.shogi.get(x, y);
	}
	getHandsSummary(color: Color){
		return this.shogi.getHandsSummary(color);
	}
	getComments(tesuu: number = this.tesuu){
		return this.getMoveFormat(tesuu).comments || [];
	}
	getMove(tesuu: number = this.tesuu){
		return this.getMoveFormat(tesuu).move;
	}
	getReadableKifu(tesuu: number = this.tesuu): string{
		if(tesuu==0) return "開始局面";
		return JKFPlayer.moveToReadableKifu(this.getMoveFormat(tesuu));
	}
	getReadableForkKifu(tesuu: number = this.tesuu): string[]{
		return this.getNextFork(tesuu).map((fork)=>JKFPlayer.moveToReadableKifu(fork[0]));
	}
	getMaxTesuu(){
		var nearestFork = this.forks[this.forks.length-1];
		return nearestFork.te+nearestFork.moves.length-1;
	}
	toJKF(){
		return JSON.stringify(this.kifu);
	}

	// private

	// 現在の局面から分岐を遡った初手から，現在の局面からの本譜の中から棋譜を得る
	private getMoveFormat(tesuu: number = this.tesuu){
		for(var i=this.forks.length-1; i>=0; i--){
			var fork = this.forks[i];
			if(fork.te<=tesuu){
				return fork.moves[tesuu-fork.te];
			}
		}
		throw "指定した手数が異常です";
	}
	private getNextFork(tesuu: number = this.tesuu){
		var next = this.getMoveFormat(tesuu+1);
		return (next && next.forks) ? next.forks : [];
	}
	private doMove(move: MoveMoveFormat){
		if(move.from){
			this.shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
		}else{
			this.shogi.drop(move.to.x, move.to.y, move.piece);
		}
	}
	private undoMove(move: MoveMoveFormat){
		if(move.from){
			this.shogi.unmove(move.from.x, move.from.y, move.to.x, move.to.y, move.promote, move.capture);
		}else{
			this.shogi.undrop(move.to.x, move.to.y);
		}
	}
}

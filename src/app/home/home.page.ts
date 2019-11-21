import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Camera, CameraOptions } from '@ionic-native/camera/ngx';
import { LoadingController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})

export class HomePage {

  passportData;
  passportProps: string[] = [];
  matchError;
  errorOnImage;
  comparisonResult;
  charsMap = {
    '<': 0,
    a: 10,
    b: 11,
    c: 12,
    d: 13,
    e: 14,
    f: 15,
    g: 16,
    h: 17,
    i: 18,
    j: 19,
    k: 20,
    l: 21,
    m: 22,
    n: 23,
    o: 24,
    p: 25,
    q: 26,
    r: 27,
    s: 28,
    t: 29,
    u: 30,
    v: 31,
    w: 32,
    x: 33,
    y: 34,
    z: 35,
  }

  constructor(private http: HttpClient, private camera: Camera, private loadingController: LoadingController) { }


  async scanDoc() {

    const options: CameraOptions = {
      quality: 70,
      destinationType: this.camera.DestinationType.DATA_URL,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE
    }

    this.camera.getPicture(options).then((imageData) => {
     
      this.matchError = false;
      this.passportData = null;
      this.errorOnImage = false;
  
      this.sendImage(imageData)
        .subscribe(
          (data: any) => {
            const doc = data.responses[0] &&
              data.responses[0].fullTextAnnotation &&
              data.responses[0].fullTextAnnotation.text
                .replace(/ /g, "")
                .replace(/(\r\n|\n|\r)/gm, "")
                .replace(/\s/g, "")
                .toUpperCase();

            if (doc && doc.length > 88) {
              this.passportData = this.getMrzData(doc);
            } else {
              this.errorOnImage = true;
            }
          },
          (error) => {
            this.errorOnImage = true;
          }
        );
    }, (err) => {
      console.log(err);
    });
  }

  sendImage(imageBase64) {
    const dataToSend = {
      requests: [
        {
          image: {
            content: imageBase64,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION'
            }
          ]
        }
      ]
    };
    return this.http
      .post('https://vision.googleapis.com/v1/images:annotate?key=AIzaSyCfes5INgo86flJFHGiQWtChX5PEa1jNf0', dataToSend);
  }

  getMrzData(doc) {
    let docType,
      country,
      nationality,
      id,
      idCD,
      nationalId,
      nationalIdCD,
      name,
      surname,
      birthDate,
      birthDateCD,
      expirationDate,
      expirationDateCD,
      sex,
      optionalData;

    let mrzMap;
    let mrz;
    // Passports have 88 chars and start with 'P'
    // IDs have 90 chars and start with 'I', 'A' or 'C'
    doc.slice(-88)[0] === 'P' ?
      (docType = 'PASSPORT') && (mrz = doc.slice(-88)) :
      (docType = 'ID') && (mrz = doc.slice(-90));

    if (docType === 'ID') {
      const line1 = mrz.slice(0, 30);
      const line2 = mrz.slice(30, 60);
      const line3 = mrz
        .slice(60, 90)
        .split("<<")
        .filter(text => text);

      country = line1.slice(2, 5).replace(/</g, "");
      id = line1.slice(5, 14).replace(/</g, "");
      idCD = line1[14];
      nationalId = line1.slice(15, line1.length).replace(/</g, "");

      birthDate = line2.slice(0, 6);
      birthDateCD = line2[6];
      sex = line2[7] === 'M' ? 'MALE' : 'FEMALE';
      expirationDate = line2.slice(8, 14);
      expirationDateCD = line2[14];
      nationality = line2.slice(15, 18).replace(/</g, "");

      name = line3[1].replace(/</g, " ");
      surname = line3[0].replace(/</g, " ");
    } else {
      const line1 = mrz
        .slice(0, 44)
        .split("<<")
        .filter(text => text);
      const line2 = mrz.slice(44, 88);

      country = line1[0].slice(2, 5).replace(/</g, "");
      name = line1[1].replace(/</g, " ");
      surname = line1[0].slice(5, line1[0].length).replace(/</g, " ");

      id = line2.slice(0, 9).replace(/</g, "");
      idCD = line2[9];
      nationality = line2.slice(10, 13).replace(/</g, "");
      birthDate = line2.slice(13, 19);
      birthDateCD = line2[19];
      sex = line2[20] === 'M' ? 'MALE' : 'FEMALE';
      expirationDate = line2.slice(21, 27);
      expirationDateCD = line2[27];
      nationalId = line2.slice(28, 41).replace(/</g, "");
      nationalIdCD = line2[42];
    }

    mrzMap = {
      docType,
      country,
      nationality,
      id,
      nationalId,
      name,
      surname,
      birthDate,
      expirationDate,
      sex,
      optionalData,
      matches: {
        id: this.matchCheckDigit(id, idCD),
        nationalId: nationalIdCD ?
          this.matchCheckDigit(nationalId, nationalIdCD) :
          true,
        expirationDate: this.matchCheckDigit(expirationDate, expirationDateCD),
        birthDate: this.matchCheckDigit(birthDate, birthDateCD),
      }
    };

    this.passportProps = Object.keys(mrzMap)
      .filter(key => mrzMap[key] && key !== 'matches' && key !== 'docType');

    return mrzMap;
  }

  matchCheckDigit(text, checkDigit, matchProperty?) {
    const checkArray = text.split('');
    const correctionArray = [7, 3, 1];
    let checkIndex = 0;
    let checkSum = 0;

    checkArray.forEach(checkItem => {
      const checkNumber = isNaN(checkItem) ? this.charsMap[checkItem.toLowerCase()] : Number(checkItem);
      checkSum = checkSum + checkNumber * correctionArray[checkIndex];
      checkIndex + 1 < 3 ? checkIndex++ : checkIndex = 0;
    });

    const checkSumResult = checkSum % 10;
    const match = checkSumResult === Number(checkDigit);

    if (!match) { this.matchError = true; }

    if (matchProperty) { this.passportData.matches[matchProperty] = match };

    return match;
  }
}
